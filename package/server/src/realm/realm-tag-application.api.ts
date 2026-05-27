import type { RealmTagApplicationDTO } from "@rezics/contract";
import {
  BasicAdminPermission,
  castRealmTagApplicationVoteSchema,
  createRealmTagApplicationSchema,
  patchRealmTagApplicationSchema,
  realmTagApplicationPathParamsSchema,
} from "@rezics/contract";
import { Elysia } from "elysia";
import { prisma } from "#/prisma/client";
import { governanceRoutePolicyService, realmPolicyActions } from "@/governance";
import { authMacro } from "@/middleware";
import { mapRealmTagApplicationToDTO } from "./realm.mapper";
import { realmService } from "./realm.service";

/**
 * Membership precondition for any realm-tag write.
 * Allowed: platform admin OR any current realm member (regardless of role).
 * Reject non-members with 403.
 */
async function ensureRealmMembership(
  actorPermission: { role: string },
  actorUserId: string,
  realmUnitId: string,
): Promise<boolean> {
  if (BasicAdminPermission(actorPermission as any)) return true;
  const member = await realmService.getMember(realmUnitId, actorUserId);
  return member !== null;
}

/**
 * Pin/delete authorization for realm-tag-applications.
 * Allowed: platform admin OR `Realm.owner` (the user attached to the
 * underlying Realm Unit). Realm moderators and regular members are rejected.
 */
async function canMutateRealmTagApplication(
  actorPermission: { role: string },
  actorUserId: string,
  realmUnitId: string,
): Promise<boolean> {
  if (BasicAdminPermission(actorPermission as any)) return true;
  const realm = await prisma.unit.findUnique({
    where: { id: realmUnitId },
    select: { userId: true },
  });
  return realm?.userId != null && realm.userId === actorUserId;
}

async function assertRealmTagVotePolicy(input: {
  identity: any;
  set: any;
  realmUnitId: string;
  unitId: string;
  tagUnitId: string;
}) {
  const decision = await governanceRoutePolicyService.decideForIdentity({
    identity: input.identity,
    action: realmPolicyActions.tagVote,
    target: {
      kind: "realm-tag-vote",
      id: `${input.realmUnitId}:${input.unitId}:${input.tagUnitId}`,
      realmUnitId: input.realmUnitId,
    },
  });
  if (!decision.allowed) {
    input.set.status = 403;
    throw new Error(
      decision.safeMessage ?? "Forbidden: policy denied this action",
    );
  }
}

export const realmTagApplicationApi = new Elysia({
  prefix: "/realm-tag-applications",
})
  .use(authMacro)

  // POST /realm-tag-applications — creation-as-vote (any realm member)
  .post(
    "/",
    async ({ body, identity, set }): Promise<RealmTagApplicationDTO> => {
      await assertRealmTagVotePolicy({
        identity,
        set,
        realmUnitId: body.realmUnitId,
        unitId: body.unitId,
        tagUnitId: body.tagUnitId,
      });
      const allowed = await ensureRealmMembership(
        identity.permission,
        identity.userId,
        body.realmUnitId,
      );
      if (!allowed) {
        set.status = 403;
        throw new Error(
          "Forbidden: only realm members may add tags inside a realm",
        );
      }
      const row = await realmService.createRealmTagApplication(
        identity.userId,
        body.realmUnitId,
        body.unitId,
        body.tagUnitId,
      );
      return mapRealmTagApplicationToDTO(row);
    },
    {
      requireLogin: true,
      body: createRealmTagApplicationSchema,
      detail: {
        summary: "Create RealmTagApplication (creation-as-vote)",
        description:
          "Membership-checked. Writes a +1 RealmTagApplicationVote on first call and recomputes RealmTagApplication.score/voteCount.",
        tags: ["Realms", "Tags"],
      },
    },
  )

  // PATCH /realm-tag-applications/:realmUnitId/:unitId/:tagUnitId — pin / position (admin or realm owner)
  .patch(
    "/:realmUnitId/:unitId/:tagUnitId",
    async ({
      params,
      body,
      identity,
      set,
    }): Promise<RealmTagApplicationDTO> => {
      const allowed = await canMutateRealmTagApplication(
        identity.permission,
        identity.userId,
        params.realmUnitId,
      );
      if (!allowed) {
        set.status = 403;
        throw new Error(
          "Forbidden: only platform admin or realm owner may pin realm tags",
        );
      }
      const row = await realmService.setRealmTagApplicationPin(
        params.realmUnitId,
        params.unitId,
        params.tagUnitId,
        body,
      );
      return mapRealmTagApplicationToDTO(row);
    },
    {
      requireLogin: true,
      params: realmTagApplicationPathParamsSchema,
      body: patchRealmTagApplicationSchema,
      detail: {
        summary: "Pin/unpin or reposition a RealmTagApplication",
        tags: ["Realms", "Tags"],
      },
    },
  )

  // DELETE /realm-tag-applications/:realmUnitId/:unitId/:tagUnitId — delete (admin or realm owner)
  .delete(
    "/:realmUnitId/:unitId/:tagUnitId",
    async ({ params, identity, set }): Promise<{ message: string }> => {
      const allowed = await canMutateRealmTagApplication(
        identity.permission,
        identity.userId,
        params.realmUnitId,
      );
      if (!allowed) {
        set.status = 403;
        throw new Error(
          "Forbidden: only platform admin or realm owner may delete realm tags",
        );
      }
      await realmService.deleteRealmTagApplication(
        params.realmUnitId,
        params.unitId,
        params.tagUnitId,
      );
      return { message: "Realm tag application deleted" };
    },
    {
      requireLogin: true,
      params: realmTagApplicationPathParamsSchema,
      detail: {
        summary: "Delete a RealmTagApplication",
        description:
          "Removes the RealmTagApplication and all underlying RealmTagApplicationVote rows. Does not cascade to UnitTag.",
        tags: ["Realms", "Tags"],
      },
    },
  );

export const realmTagApplicationVoteApi = new Elysia({
  prefix: "/realm-tag-application-votes",
})
  .use(authMacro)

  // POST /realm-tag-application-votes — explicit vote (membership-checked)
  .post(
    "/",
    async ({ body, identity, set }): Promise<{ message: string }> => {
      await assertRealmTagVotePolicy({
        identity,
        set,
        realmUnitId: body.realmUnitId,
        unitId: body.unitId,
        tagUnitId: body.tagUnitId,
      });
      const allowed = await ensureRealmMembership(
        identity.permission,
        identity.userId,
        body.realmUnitId,
      );
      if (!allowed) {
        set.status = 403;
        throw new Error("Forbidden: only realm members may vote on realm tags");
      }
      await realmService.castRealmTagApplicationVote(
        identity.userId,
        body.realmUnitId,
        body.unitId,
        body.tagUnitId,
        body.value,
      );
      return { message: "Realm tag application vote cast" };
    },
    {
      requireLogin: true,
      body: castRealmTagApplicationVoteSchema,
      detail: {
        summary: "Cast a RealmTagApplicationVote",
        description:
          "Upserts the member's vote and recomputes RealmTagApplication aggregates. Vote is retained even if the member later leaves the realm.",
        tags: ["Realms", "Tags"],
      },
    },
  );
