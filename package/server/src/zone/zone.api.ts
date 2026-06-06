import {
  parseReadLanguages,
  wikiZoneConfigSchema,
  ZoneFiltersSchema,
} from "@rezics/contract";
import { Elysia, t } from "elysia";
import { authMacro, isAdminRole } from "@/middleware";
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

  // Admin: Create zone
  .post(
    "/",
    async ({ body, identity, set }) => {
      if (!isAdminRole(identity)) {
        set.status = 403;
        return { error: "Forbidden" };
      }

      const zone = await zoneService.create({
        userId: identity.userId,
        slug: body.slug,
        translations: body.translations,
        filters: body.filters,
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
        filters: ZoneFiltersSchema,
        template: t.String(),
        styling: t.Optional(t.Object({})),
        wiki: t.Optional(t.Union([wikiZoneConfigSchema, t.Null()])),
        startsAt: t.Optional(t.String()),
        endsAt: t.Optional(t.String()),
      }),
      detail: {
        summary: "Create zone",
        description: "Create a new zone (admin only)",
        tags: ["Zones"],
      },
    },
  )

  // Admin: Update zone
  .patch(
    "/:unitId",
    async ({ params, body, identity, set }) => {
      if (!isAdminRole(identity)) {
        set.status = 403;
        return { error: "Forbidden" };
      }

      const zone = await zoneService.update(params.unitId, {
        filters: body.filters,
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
        filters: t.Optional(ZoneFiltersSchema),
        template: t.Optional(t.String()),
        styling: t.Optional(t.Union([t.Object({}), t.Null()])),
        wiki: t.Optional(t.Union([wikiZoneConfigSchema, t.Null()])),
        startsAt: t.Optional(t.Union([t.String(), t.Null()])),
        endsAt: t.Optional(t.Union([t.String(), t.Null()])),
      }),
      detail: {
        summary: "Update zone",
        description: "Update a zone's configuration (admin only)",
        tags: ["Zones"],
      },
    },
  )

  // Admin: Delete zone
  .delete(
    "/:unitId",
    async ({ params, identity, set }) => {
      if (!isAdminRole(identity)) {
        set.status = 403;
        return { error: "Forbidden" };
      }

      await zoneService.delete(params.unitId);
      return { message: "Zone deleted successfully" };
    },
    {
      requireLogin: true,
      params: t.Object({ unitId: t.String() }),
      detail: {
        summary: "Delete zone",
        description: "Delete a zone (admin only)",
        tags: ["Zones"],
      },
    },
  );

export default zoneApi;
