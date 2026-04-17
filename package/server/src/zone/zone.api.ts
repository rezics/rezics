import { ZoneFiltersSchema } from "@rezics/contract";
import { Elysia, t } from "elysia";
import { authMacro, isAdminRole } from "@/middleware";
import { zoneService } from "./zone.service";
import { mapZoneToDTO } from "./zone.mapper";

export const zoneApi = new Elysia({ prefix: "/zone" })
  .use(authMacro)

  // Public: Get zone by slug
  .get(
    "/:slug",
    async ({ params, set }) => {
      const zone = await zoneService.getBySlug(params.slug);
      if (!zone) {
        set.status = 404;
        return { error: "Zone not found" };
      }

      // Visibility check
      if (zone.unit?.visibility === "PRIVATE") {
        set.status = 404;
        return { error: "Zone not found" };
      }

      // Lifecycle check
      const lifecycleStatus = zoneService.checkLifecycle(zone);
      if (lifecycleStatus) {
        set.status = 404;
        return { error: `Zone ${lifecycleStatus === "not_started" ? "has not started yet" : "has ended"}` };
      }

      return mapZoneToDTO(zone);
    },
    {
      params: t.Object({ slug: t.String() }),
      detail: {
        summary: "Get zone by slug",
        description: "Fetch a zone's public configuration by its slug",
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
        userId: identity.unitId,
        slug: body.slug,
        translations: body.translations,
        filters: body.filters,
        template: body.template,
        styling: body.styling,
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
