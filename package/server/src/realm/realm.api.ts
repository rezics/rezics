import type {
  RealmDTO,
  RealmListResponse,
  RealmMemberDTO,
  RealmTagUnitDTO,
  RealmUnitDTO,
} from "@rezics/contract";
import {
  addRealmTagUnitSchema,
  addRealmUnitSchema,
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
import { authMacro, isAdminRole, tryResolveIdentity } from "@/middleware";
import { unitService } from "@/unit/unit.service";
import { realmService } from "./realm.service";

/** Realm roles that can moderate (update members, manage tags). */
const MODERATOR_ROLES = ["owner", "admin", "moderator"];

export const realmApi = new Elysia({ prefix: "/realm" })
  .use(authMacro)
  .get(
    "/me",
    async ({ identity }): Promise<RealmListResponse> => {
      const { realms, total } = await realmService.listByMember(identity.unitId);
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
      const identity = await tryResolveIdentity(headers["authorization"]);
      const admin = isAdminRole(identity);

      const effectiveQuery = admin
        ? query
        : { ...query, isPublic: true };

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
      const identity = await tryResolveIdentity(headers["authorization"]);
      const admin = isAdminRole(identity);

      const query = { ...body, ids: body.ids?.join(",") };
      const effectiveQuery = admin
        ? query
        : { ...query, isPublic: true };

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
    async ({ body, identity }): Promise<RealmDTO> => {
      return realmService.create(body, identity.unitId);
    },
    {
      requireLogin: true,
      body: createRealmSchema,
      detail: {
        summary: "Create realm",
        description: "Create a new realm (creator becomes owner)",
        tags: ["Realms"],
      },
    },
  )
  .put(
    "/:unitId",
    async ({
      params,
      body,
      identity,
      set,
    }): Promise<RealmDTO> => {
      const target = await unitService.getByUnitId(params.unitId);
      if (
        !hasPermissionToUpdateUnit(identity.permission, identity.unitId, target as any)
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
    async ({
      params,
      identity,
      set,
    }): Promise<{ message: string }> => {
      const target = await unitService.getByUnitId(params.unitId);
      if (
        !hasPermissionToUpdateUnit(identity.permission, identity.unitId, target as any)
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
      return realmService.getMember(params.unitId, identity.unitId);
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
        identity.unitId,
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
      set,
    }): Promise<RealmMemberDTO> => {
      // Moderator+ can update member roles
      const actorMember = await realmService.getMember(
        params.unitId,
        identity.unitId,
      );
      if (
        !actorMember ||
        (!MODERATOR_ROLES.includes(actorMember.roleKey) &&
          !BasicAdminPermission(identity.permission))
      ) {
        set.status = 403;
        throw new Error(
          "Forbidden: you do not have permission to update member roles",
        );
      }
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
      detail: {
        summary: "Update member role",
        description: "Update a member's role (moderator+ only)",
        tags: ["Realms"],
      },
    },
  )
  .delete(
    "/:unitId/members/:userId",
    async ({
      params,
      identity,
      set,
    }): Promise<{ message: string }> => {
      const isSelf = params.userId === identity.unitId;
      if (!isSelf) {
        // Only moderator+ or admin can remove others
        const actorMember = await realmService.getMember(
          params.unitId,
          identity.unitId,
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
  // --- Content feed routes ---
  .post(
    "/:unitId/content",
    async ({
      params,
      body,
      identity,
      set,
    }): Promise<RealmUnitDTO> => {
      const target = await unitService.getByUnitId(params.unitId);
      if (
        !hasPermissionToUpdateUnit(identity.permission, identity.unitId, target as any)
      ) {
        set.status = 403;
        throw new Error(
          "Forbidden: you do not have permission to add content to this realm",
        );
      }
      return realmService.addRealmUnit(params.unitId, body.unitId);
    },
    {
      requireLogin: true,
      params: realmParamsSchema,
      body: addRealmUnitSchema,
      detail: {
        summary: "Add unit to realm content feed",
        description: "Add a unit to the realm's content feed",
        tags: ["Realms"],
      },
    },
  )
  .delete(
    "/:unitId/content/:contentUnitId",
    async ({
      params,
      identity,
      set,
    }): Promise<{ message: string }> => {
      const target = await unitService.getByUnitId(params.unitId);
      if (
        !hasPermissionToUpdateUnit(identity.permission, identity.unitId, target as any)
      ) {
        set.status = 403;
        throw new Error(
          "Forbidden: you do not have permission to remove content from this realm",
        );
      }
      await realmService.removeRealmUnit(
        params.unitId,
        params.contentUnitId,
      );
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
  // --- Realm tag unit routes ---
  .post(
    "/:unitId/tags",
    async ({
      params,
      body,
      identity,
      set,
    }): Promise<RealmTagUnitDTO> => {
      // Moderator+ can manage tags
      const actorMember = await realmService.getMember(
        params.unitId,
        identity.unitId,
      );
      if (
        !actorMember ||
        (!MODERATOR_ROLES.includes(actorMember.roleKey) &&
          !BasicAdminPermission(identity.permission))
      ) {
        set.status = 403;
        throw new Error(
          "Forbidden: you do not have permission to manage realm tags",
        );
      }
      return realmService.addRealmTagUnit(
        params.unitId,
        body.tagUnitId,
        body.unitId,
      );
    },
    {
      requireLogin: true,
      params: realmParamsSchema,
      body: addRealmTagUnitSchema,
      detail: {
        summary: "Add realm-tag-unit",
        description:
          "Add a realm-tag-unit link (moderator+ only, cascades score to UnitTag)",
        tags: ["Realms"],
      },
    },
  )
  .delete(
    "/:unitId/tags/:tagUnitId/:contentUnitId",
    async ({
      params,
      identity,
      set,
    }): Promise<{ message: string }> => {
      const actorMember = await realmService.getMember(
        params.unitId,
        identity.unitId,
      );
      if (
        !actorMember ||
        (!MODERATOR_ROLES.includes(actorMember.roleKey) &&
          !BasicAdminPermission(identity.permission))
      ) {
        set.status = 403;
        throw new Error(
          "Forbidden: you do not have permission to manage realm tags",
        );
      }
      await realmService.removeRealmTagUnit(
        params.unitId,
        params.tagUnitId,
        params.contentUnitId,
      );
      return { message: "Realm tag unit removed" };
    },
    {
      requireLogin: true,
      params: t.Object({
        unitId: t.String(),
        tagUnitId: t.String(),
        contentUnitId: t.String(),
      }),
      detail: {
        summary: "Remove realm-tag-unit",
        description:
          "Remove a realm-tag-unit link (no cascade on removal)",
        tags: ["Realms"],
      },
    },
  );

export default realmApi;
