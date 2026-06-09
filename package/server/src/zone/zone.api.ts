import {
  parseReadLanguages,
  wikiZoneConfigSchema,
  ZoneFiltersSchema,
  zoneConfigVersionSchema,
  zonePagesSchema,
  zoneSectionSchema,
  zoneThemeSchema,
} from "@rezics/contract";
import { Elysia, t } from "elysia";
import { governanceRoutePolicyService, realmPolicyActions } from "@/governance";
import { authMacro } from "@/middleware";
import { mapZoneToDTO } from "./zone.mapper";
import type { ZoneWithRelations } from "./zone.service";
import { zoneService } from "./zone.service";

function resolvePublicZone(
  zone: ZoneWithRelations | null,
  set: { status?: unknown },
) {
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

  return mapZoneToDTO(zone);
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

export const zoneApi = new Elysia({ prefix: "/zone" })
  .use(authMacro)

  .get(
    "/by-slug/:slug",
    async ({ params, set }) => {
      const zone = await zoneService.getBySlug(params.slug);
      return resolvePublicZone(zone, set);
    },
    {
      params: t.Object({ slug: t.String({ minLength: 1 }) }),
      detail: {
        summary: "Get zone by slug (typed)",
        description:
          "Look up a zone by its slug (404 if slug resolves to a non-zone unit)",
        tags: ["Zones"],
      },
    },
  )

  .get(
    "/:unitId/homepage",
    async ({ params, query, set }) => {
      const zone = await zoneService.getByUnitId(params.unitId);
      const resolved = resolvePublicZone(zone, set);
      if ("error" in resolved) return resolved;

      const data = await zoneService.getWikiHomepageData(params.unitId, {
        preferredLanguages: preferredLanguages(query),
      });
      if (!data) {
        set.status = 404;
        return { error: { code: "NOT_FOUND", message: "Wiki Zone not found" } };
      }
      return data;
    },
    {
      params: t.Object({ unitId: t.String({ minLength: 1 }) }),
      query: t.Object({ languages: t.Optional(t.String()) }),
      detail: {
        summary: "Get wiki zone homepage data",
        description:
          "Resolve typed homepage section data for a public wiki Zone",
        tags: ["Zones"],
      },
    },
  )

  .get(
    "/:unitId",
    async ({ params, set }) => {
      const zone = await zoneService.getByUnitId(params.unitId);
      return resolvePublicZone(zone, set);
    },
    {
      params: t.Object({ unitId: t.String({ minLength: 1 }) }),
      detail: {
        summary: "Get zone",
        description: "Get a single zone by Unit id",
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
        filters: body.filters,
        configVersion: body.configVersion,
        pages: body.pages,
        sections: body.sections,
        theme: body.theme,
        primaryRealmUnitId: body.primaryRealmUnitId,
        template: body.template,
        styling: body.styling,
        wiki: body.wiki,
        startsAt: body.startsAt ? new Date(body.startsAt) : null,
        endsAt: body.endsAt ? new Date(body.endsAt) : null,
      });

      return mapZoneToDTO(zone);
    },
    {
      requireLogin: true,
      body: t.Object({
        slug: t.String(),
        translations: t.Array(
          t.Object({
            language: t.String(),
            title: t.Optional(t.String()),
            description: t.Optional(t.String()),
          }),
        ),
        ownerRealmUnitId: t.String(),
        filters: ZoneFiltersSchema,
        configVersion: t.Optional(zoneConfigVersionSchema),
        pages: t.Optional(t.Union([zonePagesSchema, t.Null()])),
        sections: t.Optional(t.Union([t.Array(zoneSectionSchema), t.Null()])),
        theme: t.Optional(t.Union([zoneThemeSchema, t.Null()])),
        primaryRealmUnitId: t.Optional(t.Union([t.String(), t.Null()])),
        template: t.String(),
        styling: t.Optional(t.Object({})),
        wiki: t.Optional(t.Union([wikiZoneConfigSchema, t.Null()])),
        startsAt: t.Optional(t.String()),
        endsAt: t.Optional(t.String()),
      }),
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
        filters: body.filters,
        configVersion: body.configVersion,
        pages: body.pages,
        sections: body.sections,
        theme: body.theme,
        primaryRealmUnitId: body.primaryRealmUnitId,
        template: body.template,
        styling: body.styling,
        wiki: body.wiki,
        startsAt:
          body.startsAt !== undefined
            ? body.startsAt
              ? new Date(body.startsAt)
              : null
            : undefined,
        endsAt:
          body.endsAt !== undefined
            ? body.endsAt
              ? new Date(body.endsAt)
              : null
            : undefined,
      });

      return mapZoneToDTO(zone);
    },
    {
      requireLogin: true,
      params: t.Object({ unitId: t.String() }),
      body: t.Object({
        ownerRealmUnitId: t.Optional(t.String()),
        filters: t.Optional(ZoneFiltersSchema),
        configVersion: t.Optional(zoneConfigVersionSchema),
        pages: t.Optional(t.Union([zonePagesSchema, t.Null()])),
        sections: t.Optional(t.Union([t.Array(zoneSectionSchema), t.Null()])),
        theme: t.Optional(t.Union([zoneThemeSchema, t.Null()])),
        primaryRealmUnitId: t.Optional(t.Union([t.String(), t.Null()])),
        template: t.Optional(t.String()),
        styling: t.Optional(t.Union([t.Object({}), t.Null()])),
        wiki: t.Optional(t.Union([wikiZoneConfigSchema, t.Null()])),
        startsAt: t.Optional(t.Union([t.String(), t.Null()])),
        endsAt: t.Optional(t.Union([t.String(), t.Null()])),
      }),
      detail: {
        summary: "Update zone",
        description:
          "Update a zone's configuration using the owner realm's management policy",
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
