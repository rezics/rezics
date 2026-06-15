import type { RealmTagApplicationDTO } from "@rezics/contract";
import {
  BasicAdminPermission,
  castRealmTagApplicationVoteSchema,
  createRealmTagApplicationSchema,
  patchRealmTagApplicationSchema,
  realmTagApplicationPathParamsSchema,
} from "@rezics/contract";
import { eq } from "drizzle-orm";
import { Elysia, t } from "elysia";
import { governanceRoutePolicyService, realmPolicyActions } from "@/governance";
import { authMacro, tryResolveIdentity } from "@/middleware";
import { Unit } from "../db/schema";
import { mapRealmTagApplicationToDTO } from "./realm.mapper";
import { REALM_TAG_VISIBILITY_THRESHOLD, realmService } from "./realm.service";

/**
 * Membership precondition for any realm-tag write.
 * Allowed: platform admin OR any current realm member (regardless of role).
 * Reject non-members with 403.
 * 任意 realm-tag 写操作的成员资格前置条件。
 * 允许：平台管理员或任意当前 realm 成员（不论角色）。
 * 对非成员返回 403 拒绝。
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
 * realm-tag-applications 的置顶/删除授权。
 * 允许：平台管理员或 `Realm.owner`（关联到底层 Realm Unit 的用户）。
 * realm 版主和普通成员将被拒绝。
 */
async function canMutateRealmTagApplication(
  actorPermission: { role: string },
  actorUserId: string,
  realmUnitId: string,
): Promise<boolean> {
  if (BasicAdminPermission(actorPermission as any)) return true;
  const { db } = await import("../db/client");
  const [realm] = await db
    .select({ userId: Unit.userId })
    .from(Unit)
    .where(eq(Unit.id, realmUnitId))
    .limit(1);
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
  prefix: "/realm-tag-application",
})
  .use(authMacro)

  // POST /realm-tag-application — creation-as-vote (any realm member)
  // POST /realm-tag-application — 创建即投票（任意 realm 成员）。
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

  // GET /realm-tag-application/:realmUnitId/:unitId — list applications for one target unit
  // GET /realm-tag-application/:realmUnitId/:unitId — 列出某目标 unit 在 realm 内的标签应用。
  .get(
    "/:realmUnitId/:unitId",
    async ({
      headers,
      params,
    }): Promise<{ tags: RealmTagApplicationDTO[] }> => {
      const identity = await tryResolveIdentity(
        headers.authorization,
        headers.cookie,
      );
      const isPrivileged = identity
        ? await canMutateRealmTagApplication(
            identity.permission,
            identity.userId,
            params.realmUnitId,
          )
        : false;
      const rows = await realmService.listRealmTagsForUnit(
        params.realmUnitId,
        params.unitId,
        { includeBelowThreshold: isPrivileged },
      );
      const viewerVotes = identity?.userId
        ? await realmService.getViewerRealmTagApplicationVotes(
            identity.userId,
            params.realmUnitId,
            params.unitId,
            rows.map((row) => row.tagUnitId),
          )
        : new Map<string, number>();
      return {
        tags: rows.map((row) =>
          mapRealmTagApplicationToDTO(row, {
            belowVisibilityThreshold:
              isPrivileged && row.score <= REALM_TAG_VISIBILITY_THRESHOLD,
            viewerVote: viewerVotes.get(row.tagUnitId) ?? null,
          }),
        ),
      };
    },
    {
      params: t.Object({
        realmUnitId: t.String(),
        unitId: t.String(),
      }),
      detail: {
        summary: "List RealmTagApplication rows for a unit",
        description:
          "Returns aggregate realm tag rows for one target unit, with viewerVote when the caller has voted.",
        tags: ["Realms", "Tags"],
      },
    },
  )

  // PATCH /realm-tag-application/:realmUnitId/:unitId/:tagUnitId — pin / position (admin or realm owner)
  // PATCH /realm-tag-application/:realmUnitId/:unitId/:tagUnitId — 置顶/排序（管理员或 realm 所有者）。
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

  // DELETE /realm-tag-application/:realmUnitId/:unitId/:tagUnitId — delete (admin or realm owner)
  // DELETE /realm-tag-application/:realmUnitId/:unitId/:tagUnitId — 删除（管理员或 realm 所有者）。
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
  prefix: "/realm-tag-application-vote",
})
  .use(authMacro)

  // POST /realm-tag-application-vote — explicit vote (membership-checked)
  // POST /realm-tag-application-vote — 显式投票（已检查成员资格）。
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

export const realmTagApplicationVoteWithdrawApi = new Elysia({
  prefix: "/realm-tag-application-vote",
})
  .use(authMacro)

  .delete(
    "/:realmUnitId/:unitId/:tagUnitId",
    async ({ params, identity, set }): Promise<{ message: string }> => {
      await assertRealmTagVotePolicy({
        identity,
        set,
        realmUnitId: params.realmUnitId,
        unitId: params.unitId,
        tagUnitId: params.tagUnitId,
      });
      await realmService.withdrawRealmTagApplicationVote(
        identity.userId,
        params.realmUnitId,
        params.unitId,
        params.tagUnitId,
      );
      return { message: "Realm tag vote withdrawn" };
    },
    {
      requireLogin: true,
      params: realmTagApplicationPathParamsSchema,
      detail: {
        summary: "Withdraw own RealmTagApplicationVote",
        description:
          "Deletes the caller's realm tag vote and removes the RealmTagApplication aggregate when no votes remain.",
        tags: ["Realms", "Tags"],
      },
    },
  );
