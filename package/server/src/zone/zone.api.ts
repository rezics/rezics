import {
  createZoneInputSchema,
  createZonePageInputSchema,
  parseReadLanguages,
  updateZoneBoundaryInputSchema,
  updateZoneInputSchema,
  updateZoneNavInputSchema,
  updateZonePageInputSchema,
  updateZoneThemeInputSchema,
  type ZoneBoundary,
  type ZoneListResponse,
  type ZoneNav,
  type ZonePage,
  type ZoneTheme,
  zoneListQuerySchema,
} from "@rezics/contract";
import { Elysia, t } from "elysia";
import { governanceRoutePolicyService, realmPolicyActions } from "@/governance";
import { authMacro, isAdminRole, tryResolveIdentity } from "@/middleware";
import { mapZoneToDTO } from "./zone.mapper";
import type { ZoneWithRelations } from "./zone.service";
import { zoneService } from "./zone.service";

function resolvePublicZone(
  zone: ZoneWithRelations | null,
  set: { status?: unknown },
): ZoneWithRelations | { error: { code: string; message: string } } {
  if (!zone || zone.unit?.visibility === "PRIVATE") {
    set.status = 404;
    return { error: { code: "NOT_FOUND", message: "Zone not found" } };
  }

  const lifecycleStatus = zoneService.checkLifecycle(zone);
  if (lifecycleStatus) {
    set.status = 404;
    return {
      error: {
        code: "NOT_FOUND",
        message: `Zone ${lifecycleStatus === "not_started" ? "has not started yet" : "has ended"}`,
      },
    };
  }

  return zone;
}

function preferredLanguages(query: { languages?: string }) {
  return parseReadLanguages(query.languages);
}

async function assertZoneManagePolicy(input: {
  identity: any;
  set: { status?: unknown };
  ownerRealmUnitId: string;
  zoneUnitId: string;
}) {
  const decision = await governanceRoutePolicyService.decideForIdentity({
    identity: input.identity,
    action: realmPolicyActions.zoneManage,
    target: {
      kind: "zone",
      id: input.zoneUnitId,
      realmUnitId: input.ownerRealmUnitId,
    },
  });

  if (!decision.allowed) {
    input.set.status = 403;
    return decision.safeMessage ?? "Forbidden: policy denied this action";
  }
}

function resolveMutableZone(
  zone: ZoneWithRelations | null,
  set: { status?: unknown },
) {
  if (!zone) {
    set.status = 404;
    return { error: { code: "NOT_FOUND", message: "Zone not found" } };
  }
  return zone;
}

function parseLifecycleDate(
  value: string | null | undefined,
): Date | null | undefined {
  if (value === undefined) return undefined;
  return value ? new Date(value) : null;
}

export const zoneApi = new Elysia({ prefix: "/zone" })
  .use(authMacro)

  .get(
    "/me",
    async ({ identity, query }): Promise<ZoneListResponse> => {
      const { zones, total } = await zoneService.listByUser({
        userUnitId: identity.userId,
        view: query.view,
        start: query.start,
        limit: query.limit,
      });
      const languages = preferredLanguages(query);
      return {
        zones: zones.map((zone) => mapZoneToDTO(zone, languages)),
        total,
      };
    },
    {
      requireLogin: true,
      query: zoneListQuerySchema,
      detail: {
        summary: "My zones",
        description:
          "Get zones the current user has subscribed to or can manage.",
        tags: ["Zones"],
      },
    },
  )

  .get(
    "/user/:userId",
    async ({ params, headers, query }): Promise<ZoneListResponse> => {
      const identity = await tryResolveIdentity(
        headers.authorization,
        headers.cookie,
      );
      const canSeePrivate =
        identity?.userId === params.userId || isAdminRole(identity);
      const { zones, total } = await zoneService.listByUser({
        userUnitId: params.userId,
        view: query.view,
        publicOnly: !canSeePrivate,
        start: query.start,
        limit: query.limit,
      });
      const languages = preferredLanguages(query);
      return {
        zones: zones.map((zone) => mapZoneToDTO(zone, languages)),
        total,
      };
    },
    {
      params: t.Object({ userId: t.String() }),
      query: zoneListQuerySchema,
      detail: {
        summary: "Zones for user",
        description:
          "Get zones a user has subscribed to or can manage. Public callers see only public zones.",
        tags: ["Zones"],
      },
    },
  )

  .get(
    "/by-slug/:slug",
    async ({ params, query, set }) => {
      const zone = await zoneService.getBySlug(params.slug);
      const resolved = resolvePublicZone(zone, set);
      if ("error" in resolved) return resolved;
      return mapZoneToDTO(resolved, preferredLanguages(query));
    },
    {
      params: t.Object({ slug: t.String({ minLength: 1 }) }),
      query: t.Object({ languages: t.Optional(t.String()) }),
      detail: {
        summary: "Get zone by slug",
        description:
          "Look up a zone by its slug (404 if slug resolves to a non-zone unit)",
        tags: ["Zones"],
      },
    },
  )

  .get(
    "/:unitId/portal/:pageSlug",
    async ({ params, query, set }) => {
      const zone = await zoneService.getByUnitId(params.unitId);
      const resolved = resolvePublicZone(zone, set);
      if ("error" in resolved) return resolved;
      const page = await zoneService.getPageBySlug(
        params.unitId,
        params.pageSlug,
      );
      if (!page) {
        set.status = 404;
        return {
          error: { code: "NOT_FOUND", message: "Zone page not found" },
        };
      }

      const languages = preferredLanguages(query);
      const refUnits = await zoneService.getPortalRefUnits(resolved, page, {
        preferredLanguages: languages,
      });
      return {
        zone: mapZoneToDTO(resolved, languages),
        page: {
          id: page.id,
          slug: page.slug,
          position: page.position,
          config: page.config,
        },
        refUnits,
      };
    },
    {
      params: t.Object({
        unitId: t.String({ minLength: 1 }),
        pageSlug: t.String({ minLength: 1 }),
      }),
      query: t.Object({ languages: t.Optional(t.String()) }),
      detail: {
        summary: "Get zone portal data",
        description:
          "Zone DTO plus batch summaries of every unit referenced by its config; section list data hydrates lazily per section id",
        tags: ["Zones"],
      },
    },
  )

  .get(
    "/:unitId/page/:pageId/section/:sectionId",
    async ({ params, query, set }) => {
      const zone = await zoneService.getByUnitId(params.unitId);
      const resolved = resolvePublicZone(zone, set);
      if ("error" in resolved) return resolved;

      const data = await zoneService.getSectionData(
        params.unitId,
        params.pageId,
        params.sectionId,
        {
          cursor: query.cursor ?? null,
          preferredLanguages: preferredLanguages(query),
          dynamicTagUnitIds: (query.dynamicTagUnitIds ?? "")
            .split(",")
            .map((id) => id.trim())
            .filter(Boolean),
        },
      );
      if (!data) {
        set.status = 404;
        return {
          error: { code: "NOT_FOUND", message: "Zone section not found" },
        };
      }
      return data;
    },
    {
      params: t.Object({
        unitId: t.String({ minLength: 1 }),
        pageId: t.String({ minLength: 1 }),
        sectionId: t.String({ minLength: 1 }),
      }),
      query: t.Object({
        languages: t.Optional(t.String()),
        cursor: t.Optional(t.String()),
        dynamicTagUnitIds: t.Optional(t.String()),
      }),
      detail: {
        summary: "Get zone section data",
        description:
          "Execute one section by id (query/feed/collection/stats/richText) with cursor-based continuation",
        tags: ["Zones"],
      },
    },
  )

  // Realm-authorized: Create zone
  // Realm 授权：创建 zone
  .post(
    "/",
    async ({ body, identity, set }) => {
      const denied = await assertZoneManagePolicy({
        identity,
        set,
        ownerRealmUnitId: body.ownerRealmUnitId,
        zoneUnitId: "new",
      });
      if (denied) return denied;

      const zone = await zoneService.create({
        userId: identity.userId,
        slug: body.slug,
        translations: body.translations,
        ownerRealmUnitId: body.ownerRealmUnitId,
        boundary: body.boundary as ZoneBoundary,
        nav: body.nav as ZoneNav,
        theme: body.theme as ZoneTheme,
        homePage: body.homePage as ZonePage,
        homePageSlug: body.homePageSlug,
        startsAt: parseLifecycleDate(body.startsAt) ?? null,
        endsAt: parseLifecycleDate(body.endsAt) ?? null,
      });

      return mapZoneToDTO(zone);
    },
    {
      requireLogin: true,
      body: createZoneInputSchema,
      detail: {
        summary: "Create zone",
        description:
          "Create a new zone using the owner realm's management policy",
        tags: ["Zones"],
      },
    },
  )

  // Realm-authorized: Update zone
  // Realm 授权：更新 zone
  .patch(
    "/:unitId",
    async ({ params, body, identity, set }) => {
      const current = resolveMutableZone(
        await zoneService.getByUnitId(params.unitId),
        set,
      );
      if ("error" in current) return current;

      const deniedCurrentOwner = await assertZoneManagePolicy({
        identity,
        set,
        ownerRealmUnitId: current.ownerRealmUnitId,
        zoneUnitId: params.unitId,
      });
      if (deniedCurrentOwner) return deniedCurrentOwner;

      if (
        body.ownerRealmUnitId &&
        body.ownerRealmUnitId !== current.ownerRealmUnitId
      ) {
        const deniedNextOwner = await assertZoneManagePolicy({
          identity,
          set,
          ownerRealmUnitId: body.ownerRealmUnitId,
          zoneUnitId: params.unitId,
        });
        if (deniedNextOwner) return deniedNextOwner;
      }

      const zone = await zoneService.update(params.unitId, {
        ownerRealmUnitId: body.ownerRealmUnitId,
        translations: body.translations,
        startsAt: parseLifecycleDate(body.startsAt),
        endsAt: parseLifecycleDate(body.endsAt),
      });

      return mapZoneToDTO(zone);
    },
    {
      requireLogin: true,
      params: t.Object({ unitId: t.String() }),
      body: updateZoneInputSchema,
      detail: {
        summary: "Update zone",
        description:
          "Update a zone's config, translations, or lifecycle using the owner realm's management policy",
        tags: ["Zones"],
      },
    },
  )

  .patch(
    "/:unitId/boundary",
    async ({ params, body, identity, set }) => {
      const current = resolveMutableZone(
        await zoneService.getByUnitId(params.unitId),
        set,
      );
      if ("error" in current) return current;
      const denied = await assertZoneManagePolicy({
        identity,
        set,
        ownerRealmUnitId: current.ownerRealmUnitId,
        zoneUnitId: params.unitId,
      });
      if (denied) return denied;
      return mapZoneToDTO(
        await zoneService.updateBoundary(
          params.unitId,
          body.boundary as ZoneBoundary,
        ),
      );
    },
    {
      requireLogin: true,
      params: t.Object({ unitId: t.String() }),
      body: updateZoneBoundaryInputSchema,
      detail: {
        summary: "Update zone boundary shell",
        tags: ["Zones"],
      },
    },
  )

  .patch(
    "/:unitId/nav",
    async ({ params, body, identity, set }) => {
      const current = resolveMutableZone(
        await zoneService.getByUnitId(params.unitId),
        set,
      );
      if ("error" in current) return current;
      const denied = await assertZoneManagePolicy({
        identity,
        set,
        ownerRealmUnitId: current.ownerRealmUnitId,
        zoneUnitId: params.unitId,
      });
      if (denied) return denied;
      return mapZoneToDTO(
        await zoneService.updateNav(params.unitId, body.nav as ZoneNav),
      );
    },
    {
      requireLogin: true,
      params: t.Object({ unitId: t.String() }),
      body: updateZoneNavInputSchema,
      detail: {
        summary: "Update zone nav shell",
        tags: ["Zones"],
      },
    },
  )

  .patch(
    "/:unitId/theme",
    async ({ params, body, identity, set }) => {
      const current = resolveMutableZone(
        await zoneService.getByUnitId(params.unitId),
        set,
      );
      if ("error" in current) return current;
      const denied = await assertZoneManagePolicy({
        identity,
        set,
        ownerRealmUnitId: current.ownerRealmUnitId,
        zoneUnitId: params.unitId,
      });
      if (denied) return denied;
      return mapZoneToDTO(
        await zoneService.updateTheme(params.unitId, body.theme as ZoneTheme),
      );
    },
    {
      requireLogin: true,
      params: t.Object({ unitId: t.String() }),
      body: updateZoneThemeInputSchema,
      detail: {
        summary: "Update zone theme shell",
        tags: ["Zones"],
      },
    },
  )

  .post(
    "/:unitId/pages",
    async ({ params, body, identity, set }) => {
      const current = resolveMutableZone(
        await zoneService.getByUnitId(params.unitId),
        set,
      );
      if ("error" in current) return current;
      const denied = await assertZoneManagePolicy({
        identity,
        set,
        ownerRealmUnitId: current.ownerRealmUnitId,
        zoneUnitId: params.unitId,
      });
      if (denied) return denied;
      return mapZoneToDTO(
        await zoneService.createPage(params.unitId, {
          slug: body.slug,
          position: body.position,
          config: body.config as ZonePage,
        }),
      );
    },
    {
      requireLogin: true,
      params: t.Object({ unitId: t.String() }),
      body: createZonePageInputSchema,
      detail: {
        summary: "Create zone page",
        tags: ["Zones"],
      },
    },
  )

  .patch(
    "/:unitId/pages/:pageId",
    async ({ params, body, identity, set }) => {
      const current = resolveMutableZone(
        await zoneService.getByUnitId(params.unitId),
        set,
      );
      if ("error" in current) return current;
      const denied = await assertZoneManagePolicy({
        identity,
        set,
        ownerRealmUnitId: current.ownerRealmUnitId,
        zoneUnitId: params.unitId,
      });
      if (denied) return denied;
      return mapZoneToDTO(
        await zoneService.updatePage(params.unitId, params.pageId, {
          slug: body.slug,
          position: body.position,
          config: body.config as ZonePage | undefined,
        }),
      );
    },
    {
      requireLogin: true,
      params: t.Object({ unitId: t.String(), pageId: t.String() }),
      body: updateZonePageInputSchema,
      detail: {
        summary: "Update zone page",
        tags: ["Zones"],
      },
    },
  )

  .delete(
    "/:unitId/pages/:pageId",
    async ({ params, identity, set }) => {
      const current = resolveMutableZone(
        await zoneService.getByUnitId(params.unitId),
        set,
      );
      if ("error" in current) return current;
      const denied = await assertZoneManagePolicy({
        identity,
        set,
        ownerRealmUnitId: current.ownerRealmUnitId,
        zoneUnitId: params.unitId,
      });
      if (denied) return denied;
      return mapZoneToDTO(
        await zoneService.deletePage(params.unitId, params.pageId),
      );
    },
    {
      requireLogin: true,
      params: t.Object({ unitId: t.String(), pageId: t.String() }),
      detail: {
        summary: "Delete zone page",
        tags: ["Zones"],
      },
    },
  )

  // Realm-authorized: Delete zone
  // Realm 授权：删除 zone
  .delete(
    "/:unitId",
    async ({ params, identity, set }) => {
      const current = resolveMutableZone(
        await zoneService.getByUnitId(params.unitId),
        set,
      );
      if ("error" in current) return current;

      const denied = await assertZoneManagePolicy({
        identity,
        set,
        ownerRealmUnitId: current.ownerRealmUnitId,
        zoneUnitId: params.unitId,
      });
      if (denied) return denied;

      await zoneService.delete(params.unitId);
      return { message: "Zone deleted successfully" };
    },
    {
      requireLogin: true,
      params: t.Object({ unitId: t.String() }),
      detail: {
        summary: "Delete zone",
        description: "Delete a zone using the owner realm's management policy",
        tags: ["Zones"],
      },
    },
  );

export default zoneApi;
