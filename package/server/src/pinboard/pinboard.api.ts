import {
  type PinboardAdminReadResponse,
  type PinboardOkResponse,
  type PinboardReadResponse,
  pinboardAdminReadResponseSchema,
  pinboardAppendBodySchema,
  pinboardOkResponseSchema,
  pinboardReadResponseSchema,
  pinboardReorderBodySchema,
} from "@rezics/contract";
import { Elysia, status, t } from "elysia";
import { governanceRoutePolicyService, realmPolicyActions } from "@/governance";
import { authMacro, tryResolveIdentity } from "@/middleware";
import { realmService } from "@/realm/realm.service";
import { PinboardError, pinboardService } from "./pinboard.service";

const paramsSchema = t.Object({
  unitId: t.String(),
  placement: t.String(),
});

const entryParamsSchema = t.Object({
  unitId: t.String(),
  placement: t.String(),
  contentUnitId: t.String(),
});

function handleError(error: unknown): never {
  if (error instanceof PinboardError) {
    throw status(error.httpStatus, {
      code: error.code,
      message: error.message,
    });
  }
  throw error;
}

async function assertPinboardPolicy(input: {
  identity: any;
  realmUnitId: string;
  placement: string;
}) {
  const actorMember = await realmService.getMember(
    input.realmUnitId,
    input.identity.userId,
  );
  const decision = await governanceRoutePolicyService.decideForIdentity({
    identity: input.identity,
    action: realmPolicyActions.contentPin,
    realmMembership: actorMember
      ? {
          realmUnitId: actorMember.realmUnitId,
          role: actorMember.roleKey as never,
          capabilities: actorMember.capabilities ?? [],
        }
      : null,
    target: {
      kind: "realm-content-list",
      id: `${input.realmUnitId}:pinboard:${input.placement}`,
      realmUnitId: input.realmUnitId,
    },
  });
  if (!decision.allowed) {
    throw status(
      403,
      decision.safeMessage ?? "Forbidden: policy denied this action",
    );
  }
}

export const pinboardApi = new Elysia()
  .use(authMacro)
  .get(
    "/realm/:unitId/pinboards/:placement",
    async ({ params, headers }): Promise<PinboardReadResponse> => {
      const identity = await tryResolveIdentity(
        headers["authorization"],
        headers["cookie"],
      );
      try {
        return await pinboardService.readPublic(
          identity,
          params.unitId,
          params.placement,
        );
      } catch (error) {
        handleError(error);
      }
    },
    {
      params: paramsSchema,
      response: pinboardReadResponseSchema,
      detail: {
        summary: "Read realm Pinboard",
        tags: ["Pinboard"],
      },
    },
  )
  .get(
    "/realm/:unitId/pinboards/:placement/admin",
    async ({ params, identity }): Promise<PinboardAdminReadResponse> => {
      await assertPinboardPolicy({
        identity,
        realmUnitId: params.unitId,
        placement: params.placement,
      });
      try {
        return await pinboardService.readAdmin(params.unitId, params.placement);
      } catch (error) {
        handleError(error);
      }
    },
    {
      requireLogin: true,
      params: paramsSchema,
      response: pinboardAdminReadResponseSchema,
      detail: {
        summary: "Read realm Pinboard for moderators",
        tags: ["Pinboard"],
      },
    },
  )
  .post(
    "/realm/:unitId/pinboards/:placement",
    async ({ params, body, identity }): Promise<PinboardOkResponse> => {
      await assertPinboardPolicy({
        identity,
        realmUnitId: params.unitId,
        placement: params.placement,
      });
      try {
        return await pinboardService.append({
          caller: identity,
          realmUnitId: params.unitId,
          placement: params.placement,
          unitId: body.unitId,
        });
      } catch (error) {
        handleError(error);
      }
    },
    {
      requireLogin: true,
      params: paramsSchema,
      body: pinboardAppendBodySchema,
      response: pinboardOkResponseSchema,
      detail: {
        summary: "Append to realm Pinboard",
        tags: ["Pinboard"],
      },
    },
  )
  .post(
    "/realm/:unitId/pinboards/:placement/reorder",
    async ({ params, body, identity }): Promise<PinboardOkResponse> => {
      await assertPinboardPolicy({
        identity,
        realmUnitId: params.unitId,
        placement: params.placement,
      });
      try {
        return await pinboardService.reorder({
          caller: identity,
          realmUnitId: params.unitId,
          placement: params.placement,
          unitIds: body.unitIds,
        });
      } catch (error) {
        handleError(error);
      }
    },
    {
      requireLogin: true,
      params: paramsSchema,
      body: pinboardReorderBodySchema,
      response: pinboardOkResponseSchema,
      detail: {
        summary: "Reorder realm Pinboard",
        tags: ["Pinboard"],
      },
    },
  )
  .delete(
    "/realm/:unitId/pinboards/:placement/:contentUnitId",
    async ({ params, identity }): Promise<PinboardOkResponse> => {
      await assertPinboardPolicy({
        identity,
        realmUnitId: params.unitId,
        placement: params.placement,
      });
      try {
        return await pinboardService.remove({
          caller: identity,
          realmUnitId: params.unitId,
          placement: params.placement,
          unitId: params.contentUnitId,
        });
      } catch (error) {
        handleError(error);
      }
    },
    {
      requireLogin: true,
      params: entryParamsSchema,
      response: pinboardOkResponseSchema,
      detail: {
        summary: "Remove from realm Pinboard",
        tags: ["Pinboard"],
      },
    },
  );
