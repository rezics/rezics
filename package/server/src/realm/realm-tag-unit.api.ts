import type { RealmTagUnitDTO } from "@rezics/contract";
import {
  BasicAdminPermission,
  castRealmTagVoteSchema,
  createRealmTagUnitSchema,
  patchRealmTagUnitSchema,
  realmTagUnitPathParamsSchema,
} from "@rezics/contract";
import { Elysia } from "elysia";
import { prisma } from "#/prisma/client";
import { authMacro } from "@/middleware";
import { mapRealmTagUnitToDTO } from "./realm.mapper";
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
 * Pin/delete authorization for realm-tag-units.
 * Allowed: platform admin OR `Realm.owner` (the user attached to the
 * underlying Realm Unit). Realm moderators and regular members are rejected.
 */
async function canMutateRealmTagUnit(
  actorPermission: { role: string },
  actorUserId: string,
  realmUnitId: string,
): Promise<boolean> {
  if (BasicAdminPermission(actorPermission as any)) return true;
  const realmUnit = await prisma.unit.findUnique({
    where: { id: realmUnitId },
    select: { userId: true },
  });
  return realmUnit?.userId != null && realmUnit.userId === actorUserId;
}

export const realmTagUnitApi = new Elysia({ prefix: "/realm-tag-units" })
  .use(authMacro)

  // POST /realm-tag-units — creation-as-vote (any realm member)
  .post(
    "/",
    async ({ body, identity, set }): Promise<RealmTagUnitDTO> => {
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
      const row = await realmService.createRealmTagUnit(
        identity.userId,
        body.realmUnitId,
        body.unitId,
        body.tagUnitId,
      );
      return mapRealmTagUnitToDTO(row);
    },
    {
      requireLogin: true,
      body: createRealmTagUnitSchema,
      detail: {
        summary: "Create RealmTagUnit (creation-as-vote)",
        description:
          "Membership-checked. Writes a +1 RealmTagVote on first call and recomputes RealmTagUnit.score/voteCount.",
        tags: ["Realms", "Tags"],
      },
    },
  )

  // PATCH /realm-tag-units/:realmUnitId/:unitId/:tagUnitId — pin / position (admin or realm owner)
  .patch(
    "/:realmUnitId/:unitId/:tagUnitId",
    async ({ params, body, identity, set }): Promise<RealmTagUnitDTO> => {
      const allowed = await canMutateRealmTagUnit(
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
      const row = await realmService.setRealmTagUnitPin(
        params.realmUnitId,
        params.unitId,
        params.tagUnitId,
        body,
      );
      return mapRealmTagUnitToDTO(row);
    },
    {
      requireLogin: true,
      params: realmTagUnitPathParamsSchema,
      body: patchRealmTagUnitSchema,
      detail: {
        summary: "Pin/unpin or reposition a RealmTagUnit",
        tags: ["Realms", "Tags"],
      },
    },
  )

  // DELETE /realm-tag-units/:realmUnitId/:unitId/:tagUnitId — delete (admin or realm owner)
  .delete(
    "/:realmUnitId/:unitId/:tagUnitId",
    async ({ params, identity, set }): Promise<{ message: string }> => {
      const allowed = await canMutateRealmTagUnit(
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
      await realmService.deleteRealmTagUnit(
        params.realmUnitId,
        params.unitId,
        params.tagUnitId,
      );
      return { message: "Realm tag unit deleted" };
    },
    {
      requireLogin: true,
      params: realmTagUnitPathParamsSchema,
      detail: {
        summary: "Delete a RealmTagUnit",
        description:
          "Removes the RealmTagUnit and all underlying RealmTagVote rows. Does not cascade to UnitTag.",
        tags: ["Realms", "Tags"],
      },
    },
  );

export const realmTagVoteApi = new Elysia({ prefix: "/realm-tag-votes" })
  .use(authMacro)

  // POST /realm-tag-votes — explicit vote (membership-checked)
  .post(
    "/",
    async ({ body, identity, set }): Promise<{ message: string }> => {
      const allowed = await ensureRealmMembership(
        identity.permission,
        identity.userId,
        body.realmUnitId,
      );
      if (!allowed) {
        set.status = 403;
        throw new Error("Forbidden: only realm members may vote on realm tags");
      }
      await realmService.castRealmTagVote(
        identity.userId,
        body.realmUnitId,
        body.unitId,
        body.tagUnitId,
        body.value,
      );
      return { message: "Realm tag vote cast" };
    },
    {
      requireLogin: true,
      body: castRealmTagVoteSchema,
      detail: {
        summary: "Cast a RealmTagVote",
        description:
          "Upserts the member's vote and recomputes RealmTagUnit aggregates. Vote is retained even if the member later leaves the realm.",
        tags: ["Realms", "Tags"],
      },
    },
  );
