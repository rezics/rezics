import {
  createZoneInputSchema,
  parseReadLanguages,
  updateZoneInputSchema,
  type ZoneConfig,
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
    "/:unitId/portal",
    async ({ params, query, set }) => {
      const zone = await zoneService.getByUnitId(params.unitId);
      const resolved = resolvePublicZone(zone, set);
      if ("error" in resolved) return resolved;

      const languages = preferredLanguages(query);
      const refUnits = await zoneService.getPortalRefUnits(resolved, {
        preferredLanguages: languages,
      });
      return { zone: mapZoneToDTO(resolved, languages), refUnits };
    },
    {
      params: t.Object({ unitId: t.String({ minLength: 1 }) }),
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
    "/:unitId/section/:sectionId",
    async ({ params, query, set }) => {
      const zone = await zoneService.getByUnitId(params.unitId);
      const resolved = resolvePublicZone(zone, set);
      if ("error" in resolved) return resolved;

      const data = await zoneService.getSectionData(
        params.unitId,
        params.sectionId,
        {
          cursor: query.cursor ?? null,
          preferredLanguages: preferredLanguages(query),
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
        sectionId: t.String({ minLength: 1 }),
      }),
      query: t.Object({
        languages: t.Optional(t.String()),
        cursor: t.Optional(t.String()),
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
        config: body.config as ZoneConfig,
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
        config: body.config as ZoneConfig | undefined,
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
