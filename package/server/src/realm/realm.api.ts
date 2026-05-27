import type {
  RealmDTO,
  RealmListResponse,
  RealmMemberDTO,
  RealmTagApplicationDTO,
  UnitRealmDTO,
} from "@rezics/contract";
import {
  addRealmTagApplicationSchema,
  addUnitRealmSchema,
  BasicAdminPermission,
  createRealmSchema,
  hasPermissionToUpdateUnit,
  joinRealmSchema,
  realmListBodySchema,
  realmListQuerySchema,
  realmParamsSchema,
  updateMemberRoleSchema,
  updateRealmSchema,
} from "@rezics/contract";
import { Elysia, t } from "elysia";
import { governanceRoutePolicyService, realmPolicyActions } from "@/governance";
import { authMacro, isAdminRole, tryResolveIdentity } from "@/middleware";
import { unitService } from "@/unit/unit.service";
import { mapRealmTagApplicationToDTO } from "./realm.mapper";
import { realmService } from "./realm.service";

/** Realm roles that can moderate (update members, manage tags). */
const MODERATOR_ROLES = ["owner", "admin", "moderator"];

function realmRoleCapabilities(actorMember: RealmMemberDTO | null) {
  if (!actorMember || !MODERATOR_ROLES.includes(actorMember.roleKey)) {
    return [];
  }

  return [
    {
      capability: "queue.realm.decide" as const,
      scope: {
        kind: "realm" as const,
        realmUnitId: actorMember.realmUnitId,
      },
    },
  ];
}

async function assertRealmMemberRolePolicy(input: {
  identity: any;
  status: any;
  actorMember: RealmMemberDTO | null;
  realmUnitId: string;
  targetUserId: string;
}) {
  const decision = await governanceRoutePolicyService.decideForIdentity({
    identity: input.identity,
    action: realmPolicyActions.memberRoleChange,
    realmMembership: input.actorMember
      ? {
          realmUnitId: input.actorMember.realmUnitId,
          role: input.actorMember.roleKey as never,
          capabilities: realmRoleCapabilities(input.actorMember),
        }
      : null,
    target: {
      kind: "realm-member",
      id: input.targetUserId,
      realmUnitId: input.realmUnitId,
    },
  });
  if (!decision.allowed) {
    return input.status(
      403,
      decision.safeMessage ?? "Forbidden: policy denied this action",
    );
  }
}

async function assertRealmCreatePolicy(input: { identity: any; status: any }) {
  const decision = await governanceRoutePolicyService.decideForIdentity({
    identity: input.identity,
    action: realmPolicyActions.create,
    target: { kind: "realm", id: "new" },
  });
  if (!decision.allowed) {
    return input.status(
      403,
      decision.safeMessage ?? "Forbidden: policy denied this action",
    );
  }
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

export const realmApi = new Elysia({ prefix: "/realm" })
  .use(authMacro)
  .get(
    "/me",
    async ({ identity }): Promise<RealmListResponse> => {
      const { realms, total } = await realmService.listByMember(
        identity.userId,
      );
      return { realms, total };
    },
    {
      requireLogin: true,
      detail: {
        summary: "My realms",
        description: "Get realms where current user is a member",
        tags: ["Realms"],
      },
    },
  )
  .get(
    "/member/:userId",
    async ({ params, headers }): Promise<RealmListResponse> => {
      const identity = await tryResolveIdentity(
        headers["authorization"],
        headers["cookie"],
      );
      const canSeePrivate =
        identity?.userId === params.userId || isAdminRole(identity);
      const { realms, total } = await realmService.listByMember(params.userId, {
        publicOnly: !canSeePrivate,
      });
      return { realms, total };
    },
    {
      params: t.Object({ userId: t.String() }),
      detail: {
        summary: "Realms joined by user",
        description:
          "Get realms where a user is a member. Public callers see only public realms.",
        tags: ["Realms"],
      },
    },
  )
  .get(
    "/by-slug/:slug",
    async ({
      params,
      set,
    }): Promise<RealmDTO | { error: { code: string; message: string } }> => {
      const unit = await unitService.getBySlug("realm", params.slug);
      if (!unit || unit.type !== "REALM") {
        set.status = 404;
        return { error: { code: "NOT_FOUND", message: "Realm not found" } };
      }
      return realmService.getByUnitId(unit.id);
    },
    {
      params: t.Object({ slug: t.String({ minLength: 1 }) }),
      detail: {
        summary: "Get realm by slug",
        description:
          "Look up a realm by its slug (404 if slug resolves to a non-realm unit)",
        tags: ["Realms"],
      },
    },
  )
  .get(
    "/:unitId",
    async ({ params }): Promise<RealmDTO> => {
      return realmService.getByUnitId(params.unitId);
    },
    {
      params: realmParamsSchema,
      detail: {
        summary: "Get realm",
        description: "Get a single realm by unit ID",
        tags: ["Realms"],
      },
    },
  )
  .get(
    "/list",
    async ({ headers, query }): Promise<RealmListResponse> => {
      const identity = await tryResolveIdentity(
        headers["authorization"],
        headers["cookie"],
      );
      const admin = isAdminRole(identity);

      const effectiveQuery = admin ? query : { ...query, isPublic: true };

      const { realms, total } = await realmService.list(effectiveQuery as any);
      return { realms, total };
    },
    {
      query: realmListQuerySchema,
      detail: {
        summary: "List realms",
        description:
          "List realms with filtering and pagination. Public callers see only public realms; admins have full access.",
        tags: ["Realms"],
      },
    },
  )
  .post(
    "/list",
    async ({ headers, body }): Promise<RealmListResponse> => {
      const identity = await tryResolveIdentity(
        headers["authorization"],
        headers["cookie"],
      );
      const admin = isAdminRole(identity);

      const query = { ...body, ids: body.ids?.join(",") };
      const effectiveQuery = admin ? query : { ...query, isPublic: true };

      const { realms, total } = await realmService.list(effectiveQuery as any);
      return { realms, total };
    },
    {
      body: realmListBodySchema,
      detail: {
        summary: "List realms (POST)",
        description:
          "List realms via POST body. Use when ids exceed URL length or filters contain nested objects.",
        tags: ["Realms"],
      },
    },
  )
  .post(
    "/",
    async ({ body, identity, status }): Promise<RealmDTO | string> => {
      const denied = await assertRealmCreatePolicy({ identity, status });
      if (denied) return denied;
      return realmService.create(body, identity.userId);
    },
    {
      requireLogin: true,
      body: createRealmSchema,
      response: {
        200: t.Any(),
        403: t.String(),
      },
      detail: {
        summary: "Create realm",
        description: "Create a new realm (creator becomes owner)",
        tags: ["Realms"],
      },
    },
  )
  .put(
    "/:unitId",
    async ({ params, body, identity, set }): Promise<RealmDTO> => {
      const target = await unitService.getByUnitId(params.unitId);
      if (
        !hasPermissionToUpdateUnit(
          identity.permission,
          identity.userId,
          target as any,
        )
      ) {
        set.status = 403;
        throw new Error(
          "Forbidden: you do not have permission to update this realm",
        );
      }
      return realmService.update(params.unitId, body);
    },
    {
      requireLogin: true,
      params: realmParamsSchema,
      body: updateRealmSchema,
      detail: {
        summary: "Update realm",
        description: "Update a realm (owner/admin only)",
        tags: ["Realms"],
      },
    },
  )
  .delete(
    "/:unitId",
    async ({ params, identity, set }): Promise<{ message: string }> => {
      const target = await unitService.getByUnitId(params.unitId);
      if (
        !hasPermissionToUpdateUnit(
          identity.permission,
          identity.userId,
          target as any,
        )
      ) {
        set.status = 403;
        throw new Error(
          "Forbidden: you do not have permission to delete this realm",
        );
      }
      await realmService.delete(params.unitId);
      return { message: "Realm deleted successfully" };
    },
    {
      requireLogin: true,
      params: realmParamsSchema,
      detail: {
        summary: "Delete realm",
        description: "Delete a realm (owner/admin only)",
        tags: ["Realms"],
      },
    },
  )
  // --- Membership routes ---
  .get(
    "/:unitId/members/me",
    async ({ params, identity }): Promise<RealmMemberDTO | null> => {
      return realmService.getMember(params.unitId, identity.userId);
    },
    {
      requireLogin: true,
      params: realmParamsSchema,
      detail: {
        summary: "Get my membership",
        description:
          "Get the current user's membership and role in a realm, or null if not a member",
        tags: ["Realms"],
      },
    },
  )
  .post(
    "/:unitId/members",
    async ({ params, body, identity }): Promise<RealmMemberDTO> => {
      return realmService.joinRealm(
        params.unitId,
        identity.userId,
        body?.roleKey,
      );
    },
    {
      requireLogin: true,
      params: realmParamsSchema,
      body: joinRealmSchema,
      detail: {
        summary: "Join realm",
        description: "Join a realm as a member",
        tags: ["Realms"],
      },
    },
  )
  .put(
    "/:unitId/members/:userId",
    async ({
      params,
      body,
      identity,
      status,
    }): Promise<RealmMemberDTO | string> => {
      const actorMember = await realmService.getMember(
        params.unitId,
        identity.userId,
      );
      const denied = await assertRealmMemberRolePolicy({
        identity,
        status,
        actorMember,
        realmUnitId: params.unitId,
        targetUserId: params.userId,
      });
      if (denied) return denied;
      return realmService.updateMemberRole(
        params.unitId,
        params.userId,
        body.roleKey,
      );
    },
    {
      requireLogin: true,
      params: t.Object({ unitId: t.String(), userId: t.String() }),
      body: updateMemberRoleSchema,
      response: {
        200: t.Any(),
        403: t.String(),
      },
      detail: {
        summary: "Update member role",
        description: "Update a member's role",
        tags: ["Realms"],
      },
    },
  )
  .delete(
    "/:unitId/members/:userId",
    async ({ params, identity, set }): Promise<{ message: string }> => {
      const isSelf = params.userId === identity.userId;
      if (!isSelf) {
        // Only moderator+ or admin can remove others
        const actorMember = await realmService.getMember(
          params.unitId,
          identity.userId,
        );
        if (
          !actorMember ||
          (!MODERATOR_ROLES.includes(actorMember.roleKey) &&
            !BasicAdminPermission(identity.permission))
        ) {
          set.status = 403;
          throw new Error(
            "Forbidden: you do not have permission to remove this member",
          );
        }
      }
      await realmService.removeMember(params.unitId, params.userId);
      return { message: "Member removed successfully" };
    },
    {
      requireLogin: true,
      params: t.Object({ unitId: t.String(), userId: t.String() }),
      detail: {
        summary: "Remove member / leave realm",
        description: "Remove a member from a realm or leave the realm",
        tags: ["Realms"],
      },
    },
  )
  // --- Subscription / mute (engagement-subscription, design D5) ---
  .post(
    "/:unitId/mute",
    async ({ params, identity }): Promise<{ muted: boolean }> => {
      await realmService.muteRealm(params.unitId, identity.userId);
      return { muted: true };
    },
    {
      requireLogin: true,
      params: realmParamsSchema,
      detail: {
        summary: "Mute realm",
        description:
          "Suppress realm activity notifications by removing the Subscription edge while keeping RealmMember intact.",
        tags: ["Realms"],
      },
    },
  )
  .post(
    "/:unitId/unmute",
    async ({ params, identity }): Promise<{ muted: boolean }> => {
      await realmService.unmuteRealm(params.unitId, identity.userId);
      return { muted: false };
    },
    {
      requireLogin: true,
      params: realmParamsSchema,
      detail: {
        summary: "Unmute realm",
        description:
          "Re-enable realm activity notifications by re-adding the Subscription edge (channels=['*']).",
        tags: ["Realms"],
      },
    },
  )
  // --- Content feed routes ---
  .post(
    "/:unitId/content",
    async ({ params, body, identity, set }): Promise<UnitRealmDTO> => {
      const target = await unitService.getByUnitId(params.unitId);
      if (
        !hasPermissionToUpdateUnit(
          identity.permission,
          identity.userId,
          target as any,
        )
      ) {
        set.status = 403;
        throw new Error(
          "Forbidden: you do not have permission to add content to this realm",
        );
      }
      return realmService.addUnitRealm(params.unitId, body.unitId);
    },
    {
      requireLogin: true,
      params: realmParamsSchema,
      body: addUnitRealmSchema,
      detail: {
        summary: "Add unit to realm content feed",
        description: "Add a unit to the realm's content feed",
        tags: ["Realms"],
      },
    },
  )
  .delete(
    "/:unitId/content/:contentUnitId",
    async ({ params, identity, set }): Promise<{ message: string }> => {
      const target = await unitService.getByUnitId(params.unitId);
      if (
        !hasPermissionToUpdateUnit(
          identity.permission,
          identity.userId,
          target as any,
        )
      ) {
        set.status = 403;
        throw new Error(
          "Forbidden: you do not have permission to remove content from this realm",
        );
      }
      await realmService.removeUnitRealm(params.unitId, params.contentUnitId);
      return { message: "Content removed from realm" };
    },
    {
      requireLogin: true,
      params: t.Object({
        unitId: t.String(),
        contentUnitId: t.String(),
      }),
      detail: {
        summary: "Remove unit from realm content feed",
        description: "Remove a unit from the realm's content feed",
        tags: ["Realms"],
      },
    },
  )
  // --- Realm tag application routes ---
  .post(
    "/:unitId/tags",
    async ({
      params,
      body,
      identity,
      set,
    }): Promise<RealmTagApplicationDTO> => {
      await assertRealmTagVotePolicy({
        identity,
        set,
        realmUnitId: params.unitId,
        unitId: body.unitId,
        tagUnitId: body.tagUnitId,
      });
      // Any realm member may add a tag inside a realm; creation acts as a
      // vote. Pin/delete is restricted to admin/realm-owner via the
      // separate `/realm-tag-applications` route.
      const isAdmin = BasicAdminPermission(identity.permission);
      if (!isAdmin) {
        const actorMember = await realmService.getMember(
          params.unitId,
          identity.userId,
        );
        if (!actorMember) {
          set.status = 403;
          throw new Error(
            "Forbidden: only realm members may add tags inside a realm",
          );
        }
      }
      const row = await realmService.createRealmTagApplication(
        identity.userId,
        params.unitId,
        body.unitId,
        body.tagUnitId,
      );
      return mapRealmTagApplicationToDTO(row);
    },
    {
      requireLogin: true,
      params: realmParamsSchema,
      body: addRealmTagApplicationSchema,
      detail: {
        summary: "Add realm-tag-application",
        description:
          "Add a realm-tag-application link. Membership-checked; creation acts as a +1 RealmTagApplicationVote. Pin/delete uses /realm-tag-applications.",
        tags: ["Realms"],
      },
    },
  )
  .delete(
    "/:unitId/tags/:tagUnitId/:contentUnitId",
    async ({ params, identity, set }): Promise<{ message: string }> => {
      // Pin/delete is restricted to platform admin or `Realm.owner`.
      if (!BasicAdminPermission(identity.permission)) {
        const realm = await unitService.getByUnitId(params.unitId);
        if (!realm?.userId || realm.userId !== identity.userId) {
          set.status = 403;
          throw new Error(
            "Forbidden: only platform admin or realm owner may delete realm tags",
          );
        }
      }
      await realmService.deleteRealmTagApplication(
        params.unitId,
        params.contentUnitId,
        params.tagUnitId,
      );
      return { message: "Realm tag application removed" };
    },
    {
      requireLogin: true,
      params: t.Object({
        unitId: t.String(),
        tagUnitId: t.String(),
        contentUnitId: t.String(),
      }),
      detail: {
        summary: "Remove realm-tag-application",
        description:
          "Remove a realm-tag-application link (no cascade on removal)",
        tags: ["Realms"],
      },
    },
  );

export default realmApi;
