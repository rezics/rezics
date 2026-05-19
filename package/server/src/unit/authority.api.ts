import {
  createUnitFieldLockSchema,
  type LockFieldKey,
  unitCollaboratorListResponseSchema,
  unitCollaboratorSchema,
  unitFieldLockListResponseSchema,
  unitFieldLockSchema,
  unitParamsSchema,
  upsertUnitCollaboratorSchema,
} from "@rezics/contract";
import { Elysia, t } from "elysia";
import { authMacro } from "@/middleware";
import { unitAuthorityService } from "./authority.service";

const fieldLockParamsSchema = t.Object({
  unitId: t.String(),
  fieldKey: t.String(),
});

const collaboratorParamsSchema = t.Object({
  unitId: t.String(),
  userId: t.String(),
});

export const unitAuthorityApi = new Elysia({ prefix: "/unit" })
  .use(authMacro)
  .get(
    "/:unitId/collaborators",
    async ({ params }) => ({
      collaborators: await unitAuthorityService.listCollaborators(
        params.unitId,
      ),
    }),
    {
      requireLogin: true,
      params: unitParamsSchema,
      response: unitCollaboratorListResponseSchema,
      detail: {
        summary: "List Unit collaborators",
        tags: ["Units", "Authority"],
      },
    },
  )
  .put(
    "/:unitId/collaborators/:userId",
    async ({ params, body, identity }) =>
      unitAuthorityService.upsertCollaborator(params.unitId, identity, {
        ...body,
        userId: params.userId,
      }),
    {
      requireLogin: true,
      params: collaboratorParamsSchema,
      body: t.Omit(upsertUnitCollaboratorSchema, ["userId"]),
      response: unitCollaboratorSchema,
      detail: {
        summary: "Add or update Unit collaborator",
        tags: ["Units", "Authority"],
      },
    },
  )
  .delete(
    "/:unitId/collaborators/:userId",
    async ({ params, identity }) => {
      await unitAuthorityService.removeCollaborator(
        params.unitId,
        identity,
        params.userId,
      );
      return { message: "Collaborator removed" };
    },
    {
      requireLogin: true,
      params: collaboratorParamsSchema,
      detail: {
        summary: "Remove Unit collaborator",
        tags: ["Units", "Authority"],
      },
    },
  )
  .get(
    "/:unitId/field-locks",
    async ({ params }) => ({
      locks: await unitAuthorityService.listFieldLocks(params.unitId),
    }),
    {
      requireLogin: true,
      params: unitParamsSchema,
      response: unitFieldLockListResponseSchema,
      detail: {
        summary: "List Unit field locks",
        tags: ["Units", "Authority"],
      },
    },
  )
  .put(
    "/:unitId/field-locks/:fieldKey",
    async ({ params, body, identity }) =>
      unitAuthorityService.createFieldLock(params.unitId, identity, {
        ...body,
        fieldKey: params.fieldKey as LockFieldKey,
      }),
    {
      requireLogin: true,
      params: fieldLockParamsSchema,
      body: t.Omit(createUnitFieldLockSchema, ["fieldKey"]),
      response: unitFieldLockSchema,
      detail: {
        summary: "Create or update Unit field lock",
        tags: ["Units", "Authority"],
      },
    },
  )
  .delete(
    "/:unitId/field-locks/:fieldKey",
    async ({ params, identity }) => {
      await unitAuthorityService.deleteFieldLock(
        params.unitId,
        identity,
        params.fieldKey,
      );
      return { message: "Field lock removed" };
    },
    {
      requireLogin: true,
      params: fieldLockParamsSchema,
      detail: {
        summary: "Remove Unit field lock",
        tags: ["Units", "Authority"],
      },
    },
  );

export type UnitAuthorityApi = typeof unitAuthorityApi;
