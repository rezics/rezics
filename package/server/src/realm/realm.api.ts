import type {
  RealmDTO,
  RealmExtraAdminReadResponse,
  RealmExtraOkResponse,
  RealmExtraReadResponse,
  RealmListResponse,
  RealmMemberDTO,
  RealmMemberListResponse,
  RealmMembershipMeDTO,
  RealmRuleAcknowledgementDTO,
  RealmRuleReferenceDTO,
  RealmRuleResolvedDTO,
  RealmTagApplicationDTO,
  UnitRealmDTO,
} from "@rezics/contract";
import {
  acknowledgeRealmRuleSchema,
  addRealmTagApplicationSchema,
  addUnitRealmSchema,
  BasicAdminPermission,
  createRealmSchema,
  hasPermissionToUpdateUnit,
  joinRealmSchema,
  realmExtraAdminReadResponseSchema,
  realmExtraAppendBodySchema,
  realmExtraOkResponseSchema,
  realmExtraReadResponseSchema,
  realmExtraReorderBodySchema,
  realmListBodySchema,
  realmListQuerySchema,
  realmMemberListQuerySchema,
  realmMemberListResponseSchema,
  realmParamsSchema,
  realmReadQuerySchema,
  resolveRealmRuleQuerySchema,
  updateMemberRoleSchema,
  updateRealmRulePolicySchema,
  updateRealmSchema,
} from "@rezics/contract";
import { Elysia, t } from "elysia";
import { governanceRoutePolicyService, realmPolicyActions } from "@/governance";
import { authMacro, isAdminRole, tryResolveIdentity } from "@/middleware";
import {
  resolveEffectiveReadLanguageCandidates,
  resolveEffectiveReadLanguageInput,
} from "@/unit/language-resolution";
import { unitService } from "@/unit/unit.service";
import { mapRealmTagApplicationToDTO } from "./realm.mapper";
import { realmService } from "./realm.service";

/**
 * Realm roles that can moderate (update members, manage tags).
 * 可进行管理操作（更新成员、管理标签）的 realm 角色。
 */
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

async function assertRealmContentPinPolicy(input: {
  identity: any;
  status: any;
  realmUnitId: string;
  targetId: string;
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
      id: input.targetId,
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

async function assertRealmRulesUpdatePolicy(input: {
  identity: any;
  status: any;
  realmUnitId: string;
}) {
  const actorMember = await realmService.getMember(
    input.realmUnitId,
    input.identity.userId,
  );
  const decision = await governanceRoutePolicyService.decideForIdentity({
    identity: input.identity,
    action: realmPolicyActions.rulesUpdate,
    realmMembership: actorMember
      ? {
          realmUnitId: actorMember.realmUnitId,
          role: actorMember.roleKey as never,
          capabilities: actorMember.capabilities ?? [],
        }
      : null,
    target: {
      kind: "realm-rules",
      id: input.realmUnitId,
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

export const realmApi = new Elysia({ prefix: "/realm" })
  .use(authMacro)
  .get(
    "/me",
    async ({ identity, query }): Promise<RealmListResponse> => {
      const { realms, total } = await realmService.listByMember(
        identity.userId,
        {
          ...resolveEffectiveReadLanguageInput({
            languages: query.languages,
            appLocale: query.appLocale,
          }),
          languageMode: query.languageMode,
        },
      );
      return { realms, total };
    },
    {
      requireLogin: true,
      query: realmListQuerySchema,
      detail: {
        summary: "My realms",
        description: "Get realms where current user is a member",
        tags: ["Realms"],
      },
    },
  )
  .get(
    "/member/:userId",
    async ({ params, headers, query }): Promise<RealmListResponse> => {
      const identity = await tryResolveIdentity(
        headers["authorization"],
        headers["cookie"],
      );
      const canSeePrivate =
        identity?.userId === params.userId || isAdminRole(identity);
      const { realms, total } = await realmService.listByMember(params.userId, {
        publicOnly: !canSeePrivate,
        ...resolveEffectiveReadLanguageInput({
          languages: query.languages,
          appLocale: query.appLocale,
        }),
        languageMode: query.languageMode,
      });
      return { realms, total };
    },
    {
      params: t.Object({ userId: t.String() }),
      query: realmListQuerySchema,
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
      headers,
      query,
    }): Promise<RealmDTO | { error: { code: string; message: string } }> => {
      const identity = await tryResolveIdentity(
        headers["authorization"],
        headers["cookie"],
      );
      const unit = await unitService.getBySlug("realm", params.slug);
      if (!unit || unit.type !== "REALM") {
        set.status = 404;
        return { error: { code: "NOT_FOUND", message: "Realm not found" } };
      }
      const readLanguage = resolveEffectiveReadLanguageInput({
        explicitLanguage: query.explicitLanguage,
        languages: query.languages,
        appLocale: query.appLocale,
      });
      return realmService.getByUnitId(unit.id, identity?.userId, readLanguage);
    },
    {
      params: t.Object({ slug: t.String({ minLength: 1 }) }),
      query: realmReadQuerySchema,
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
    async ({ params, headers, query }): Promise<RealmDTO> => {
      const identity = await tryResolveIdentity(
        headers["authorization"],
        headers["cookie"],
      );
      const readLanguage = resolveEffectiveReadLanguageInput({
        explicitLanguage: query.explicitLanguage,
        languages: query.languages,
        appLocale: query.appLocale,
      });
      return realmService.getByUnitId(
        params.unitId,
        identity?.userId,
        readLanguage,
      );
    },
    {
      params: realmParamsSchema,
      query: realmReadQuerySchema,
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
  .get(
    "/:unitId/pinboard",
    async ({ params, headers }): Promise<RealmExtraReadResponse> => {
      const identity = await tryResolveIdentity(
        headers["authorization"],
        headers["cookie"],
      );
      return realmService.readCommunityList(
        identity,
        params.unitId,
        "pinboard",
      );
    },
    {
      params: realmParamsSchema,
      response: realmExtraReadResponseSchema,
      detail: {
        summary: "Read realm pinboard",
        description:
          "Read the public, stale-filtered Pinboard list backed by Realm.extra.pinboard",
        tags: ["Realms"],
      },
    },
  )
  .get(
    "/:unitId/pinboard/admin",
    async ({
      params,
      identity,
      status,
    }): Promise<RealmExtraAdminReadResponse | string> => {
      const denied = await assertRealmContentPinPolicy({
        identity,
        status,
        realmUnitId: params.unitId,
        targetId: `${params.unitId}:pinboard`,
      });
      if (denied) return denied;
      return realmService.readCommunityListAdmin(
        identity,
        params.unitId,
        "pinboard",
      );
    },
    {
      requireLogin: true,
      params: realmParamsSchema,
      response: {
        200: realmExtraAdminReadResponseSchema,
        403: t.String(),
      },
      detail: {
        summary: "Read realm pinboard for moderators",
        description:
          "Read the full Pinboard list, including stale IDs, backed by Realm.extra.pinboard",
        tags: ["Realms"],
      },
    },
  )
  .post(
    "/:unitId/pinboard",
    async ({
      params,
      body,
      identity,
      status,
    }): Promise<RealmExtraOkResponse | string> => {
      const denied = await assertRealmContentPinPolicy({
        identity,
        status,
        realmUnitId: params.unitId,
        targetId: `${params.unitId}:pinboard`,
      });
      if (denied) return denied;
      return realmService.appendCommunityList(
        identity,
        params.unitId,
        "pinboard",
        body.unitId,
      );
    },
    {
      requireLogin: true,
      params: realmParamsSchema,
      body: realmExtraAppendBodySchema,
      response: {
        200: realmExtraOkResponseSchema,
        403: t.String(),
      },
      detail: {
        summary: "Append to realm pinboard",
        description:
          "Append a Unit to the Pinboard using the Realm.extra.pinboard primitive",
        tags: ["Realms"],
      },
    },
  )
  .post(
    "/:unitId/pinboard/reorder",
    async ({
      params,
      body,
      identity,
      status,
    }): Promise<RealmExtraOkResponse | string> => {
      const denied = await assertRealmContentPinPolicy({
        identity,
        status,
        realmUnitId: params.unitId,
        targetId: `${params.unitId}:pinboard`,
      });
      if (denied) return denied;
      return realmService.reorderCommunityList(
        identity,
        params.unitId,
        "pinboard",
        body.unitIds,
      );
    },
    {
      requireLogin: true,
      params: realmParamsSchema,
      body: realmExtraReorderBodySchema,
      response: {
        200: realmExtraOkResponseSchema,
        403: t.String(),
      },
      detail: {
        summary: "Reorder realm pinboard",
        description:
          "Reorder the Pinboard using the Realm.extra.pinboard primitive",
        tags: ["Realms"],
      },
    },
  )
  .delete(
    "/:unitId/pinboard/:contentUnitId",
    async ({
      params,
      identity,
      status,
    }): Promise<RealmExtraOkResponse | string> => {
      const denied = await assertRealmContentPinPolicy({
        identity,
        status,
        realmUnitId: params.unitId,
        targetId: `${params.unitId}:pinboard`,
      });
      if (denied) return denied;
      return realmService.removeCommunityListEntry(
        identity,
        params.unitId,
        "pinboard",
        params.contentUnitId,
      );
    },
    {
      requireLogin: true,
      params: t.Object({ unitId: t.String(), contentUnitId: t.String() }),
      response: {
        200: realmExtraOkResponseSchema,
        403: t.String(),
      },
      detail: {
        summary: "Remove from realm pinboard",
        description:
          "Remove a Unit from the Pinboard using the Realm.extra.pinboard primitive",
        tags: ["Realms"],
      },
    },
  )
  .get(
    "/:unitId/announcements",
    async ({ params, headers }): Promise<RealmExtraReadResponse> => {
      const identity = await tryResolveIdentity(
        headers["authorization"],
        headers["cookie"],
      );
      return realmService.readCommunityList(
        identity,
        params.unitId,
        "announcement",
      );
    },
    {
      params: realmParamsSchema,
      response: realmExtraReadResponseSchema,
      detail: {
        summary: "Read realm announcements",
        description:
          "Read the public, stale-filtered special announcement list backed by Realm.extra.announcement",
        tags: ["Realms"],
      },
    },
  )
  .get(
    "/:unitId/announcements/admin",
    async ({
      params,
      identity,
      status,
    }): Promise<RealmExtraAdminReadResponse | string> => {
      const denied = await assertRealmContentPinPolicy({
        identity,
        status,
        realmUnitId: params.unitId,
        targetId: `${params.unitId}:announcement`,
      });
      if (denied) return denied;
      return realmService.readCommunityListAdmin(
        identity,
        params.unitId,
        "announcement",
      );
    },
    {
      requireLogin: true,
      params: realmParamsSchema,
      response: {
        200: realmExtraAdminReadResponseSchema,
        403: t.String(),
      },
      detail: {
        summary: "Read realm announcements for moderators",
        description:
          "Read the full special announcement list, including stale IDs, backed by Realm.extra.announcement",
        tags: ["Realms"],
      },
    },
  )
  .post(
    "/:unitId/announcements",
    async ({
      params,
      body,
      identity,
      status,
    }): Promise<RealmExtraOkResponse | string> => {
      const denied = await assertRealmContentPinPolicy({
        identity,
        status,
        realmUnitId: params.unitId,
        targetId: `${params.unitId}:announcement`,
      });
      if (denied) return denied;
      return realmService.appendCommunityList(
        identity,
        params.unitId,
        "announcement",
        body.unitId,
      );
    },
    {
      requireLogin: true,
      params: realmParamsSchema,
      body: realmExtraAppendBodySchema,
      response: {
        200: realmExtraOkResponseSchema,
        403: t.String(),
      },
      detail: {
        summary: "Append to realm announcements",
        description:
          "Append a Unit to special announcements using the Realm.extra.announcement primitive",
        tags: ["Realms"],
      },
    },
  )
  .post(
    "/:unitId/announcements/reorder",
    async ({
      params,
      body,
      identity,
      status,
    }): Promise<RealmExtraOkResponse | string> => {
      const denied = await assertRealmContentPinPolicy({
        identity,
        status,
        realmUnitId: params.unitId,
        targetId: `${params.unitId}:announcement`,
      });
      if (denied) return denied;
      return realmService.reorderCommunityList(
        identity,
        params.unitId,
        "announcement",
        body.unitIds,
      );
    },
    {
      requireLogin: true,
      params: realmParamsSchema,
      body: realmExtraReorderBodySchema,
      response: {
        200: realmExtraOkResponseSchema,
        403: t.String(),
      },
      detail: {
        summary: "Reorder realm announcements",
        description:
          "Reorder special announcements using the Realm.extra.announcement primitive",
        tags: ["Realms"],
      },
    },
  )
  .delete(
    "/:unitId/announcements/:contentUnitId",
    async ({
      params,
      identity,
      status,
    }): Promise<RealmExtraOkResponse | string> => {
      const denied = await assertRealmContentPinPolicy({
        identity,
        status,
        realmUnitId: params.unitId,
        targetId: `${params.unitId}:announcement`,
      });
      if (denied) return denied;
      return realmService.removeCommunityListEntry(
        identity,
        params.unitId,
        "announcement",
        params.contentUnitId,
      );
    },
    {
      requireLogin: true,
      params: t.Object({ unitId: t.String(), contentUnitId: t.String() }),
      response: {
        200: realmExtraOkResponseSchema,
        403: t.String(),
      },
      detail: {
        summary: "Remove from realm announcements",
        description:
          "Remove a Unit from special announcements using the Realm.extra.announcement primitive",
        tags: ["Realms"],
      },
    },
  )
  // --- Membership routes ---
  // --- 成员关系路由 ---
  .get(
    "/:unitId/members/me",
    async ({ params, identity }): Promise<RealmMembershipMeDTO> => {
      return realmService.getMembershipMe(params.unitId, identity.userId);
    },
    {
      requireLogin: true,
      params: realmParamsSchema,
      detail: {
        summary: "Get my membership",
        description:
          "Get the current user's membership, capability hints, and rule acknowledgement state in a realm",
        tags: ["Realms"],
      },
    },
  )
  .get(
    "/:unitId/members",
    async ({
      params,
      query,
      identity,
      set,
    }): Promise<RealmMemberListResponse> => {
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
          "Forbidden: you do not have permission to list members",
        );
      }
      return realmService.listMembers(params.unitId, query);
    },
    {
      requireLogin: true,
      params: realmParamsSchema,
      query: realmMemberListQuerySchema,
      response: {
        200: realmMemberListResponseSchema,
        403: t.String(),
      },
      detail: {
        summary: "List realm members",
        description: "List the roster for realm moderators and staff",
        tags: ["Realms"],
      },
    },
  )
  .get(
    "/:unitId/rules/resolved",
    async ({ params, query, status }) => {
      try {
        const languages = resolveEffectiveReadLanguageCandidates({
          explicitLanguage: query.language,
          languages: query.languages,
          appLocale: query.appLocale,
        });
        return await realmService.resolveRule(
          params.unitId,
          query.language,
          languages,
        );
      } catch {
        return status(404, "Realm not found");
      }
    },
    {
      params: realmParamsSchema,
      query: resolveRealmRuleQuerySchema,
      response: {
        200: t.Any(),
        404: t.String(),
      },
      detail: {
        summary: "Resolve current realm rule",
        description:
          "Resolve the current realm rule Unit to the best UnitTranslation and optional source rule Post for display",
        tags: ["Realms"],
      },
    },
  )
  .get(
    "/:unitId/rules",
    async ({ params, status }) => {
      try {
        return await realmService.getRulePolicy(params.unitId);
      } catch {
        return status(404, "Realm not found");
      }
    },
    {
      params: realmParamsSchema,
      response: {
        200: t.Any(),
        404: t.String(),
      },
      detail: {
        summary: "Get realm rule policy",
        description:
          "Read the realm's current rule Unit reference, version, and acknowledgement requirements",
        tags: ["Realms"],
      },
    },
  )
  .post(
    "/:unitId/rules",
    async ({
      params,
      body,
      identity,
      status,
    }): Promise<RealmRuleReferenceDTO | string> => {
      const denied = await assertRealmRulesUpdatePolicy({
        identity,
        status,
        realmUnitId: params.unitId,
      });
      if (denied) return denied;
      return realmService.updateRulePolicy(identity, params.unitId, body);
    },
    {
      requireLogin: true,
      params: realmParamsSchema,
      body: updateRealmRulePolicySchema,
      response: {
        200: t.Any(),
        403: t.String(),
      },
      detail: {
        summary: "Update realm rule policy",
        description:
          "Update the realm's current rule Unit reference, version, and acknowledgement requirements",
        tags: ["Realms"],
      },
    },
  )
  .post(
    "/:unitId/rules/acknowledgement",
    async ({ params, body, identity, status }) => {
      try {
        return await realmService.acknowledgeCurrentRule(
          params.unitId,
          identity.userId,
          body,
        );
      } catch {
        return status(400, "Realm does not have a current rule Unit");
      }
    },
    {
      requireLogin: true,
      params: realmParamsSchema,
      body: acknowledgeRealmRuleSchema,
      response: {
        200: t.Any(),
        400: t.String(),
      },
      detail: {
        summary: "Acknowledge current realm rules",
        description:
          "Record the current user's acknowledgement of the rule Unit and version configured for this realm",
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
        // 仅 moderator 及以上或 admin 可移除他人
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
      await realmService.removeMember(
        params.unitId,
        params.userId,
        isSelf
          ? undefined
          : {
              moderation: {
                actorUserId: identity.userId,
                reasonCode: "realm.member.removed",
              },
            },
      );
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
  // --- Subscription / mute (RealmMember and Subscription are orthogonal
  // edges: mute removes only the Subscription, leaving membership intact) ---
  // --- 订阅 / 静音（RealmMember 与 Subscription 是正交的边：静音仅移除
  // Subscription，保留成员关系不变）---
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
  // --- 内容流路由 ---
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
      return realmService.addUnitRealm(params.unitId, body.unitId, body);
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
  // --- Realm 标签应用路由 ---
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
      // separate `/realm-tag-application` route.
      // 任何 realm 成员都可在 realm 内添加标签；创建即视为一次投票。置顶/删除
      // 通过单独的 `/realm-tag-application` 路由限定给 admin/realm-owner。
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
          "Add a realm-tag-application link. Membership-checked; creation acts as a +1 RealmTagApplicationVote. Pin/delete uses /realm-tag-application.",
        tags: ["Realms"],
      },
    },
  )
  .delete(
    "/:unitId/tags/:tagUnitId/:contentUnitId",
    async ({ params, identity, set }): Promise<{ message: string }> => {
      // Pin/delete is restricted to platform admin or `Realm.owner`.
      // 置顶/删除仅限平台 admin 或 `Realm.owner`。
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
