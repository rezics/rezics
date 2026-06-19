import type { Static } from "elysia";
import { t } from "elysia";
import { createVersionedEnvelopeParser } from "../envelope/envelope";
import { pageSectionQuerySchema } from "../pages";

export const ZONE_BOUNDARY_SCHEMA = "rezics/zone-boundary" as const;
export const ZONE_BOUNDARY_V1_VERSION = 1 as const;

/**
 * Authority vs context: `Zone.ownerRealmUnitId` (table column, FK) is
 * permission authority only. `boundary.context` is interaction defaults only
 * (section query inheritance, create-CTA target, comment selector default).
 * They may differ: official zones are owned by the rezics realm with global
 * context.
 */
export const zoneContextSchema = t.Union([
  t.Object({ kind: t.Literal("global") }, { additionalProperties: false }),
  t.Object(
    { kind: t.Literal("realm"), realmUnitId: t.String() },
    { additionalProperties: false },
  ),
]);

export type ZoneContext = Static<typeof zoneContextSchema>;

/**
 * The `PageSectionQuery` filter vocabulary minus `sort` and `target`. An
 * unremovable boundary intersected with every zone query section, zone search,
 * and zone streams; section queries and user filters only narrow within it.
 */
export const zoneBoundaryFilterSchema = t.Object(
  {
    types: pageSectionQuerySchema.properties.types,
    postKinds: pageSectionQuerySchema.properties.postKinds,
    realm: pageSectionQuerySchema.properties.realm,
    tagUnitIds: pageSectionQuerySchema.properties.tagUnitIds,
    realmTagUnitIds: pageSectionQuerySchema.properties.realmTagUnitIds,
    subjects: pageSectionQuerySchema.properties.subjects,
    targetUnitId: pageSectionQuerySchema.properties.targetUnitId,
    languages: pageSectionQuerySchema.properties.languages,
    ratings: pageSectionQuerySchema.properties.ratings,
  },
  { additionalProperties: false },
);

export type ZoneBoundaryFilter = Static<typeof zoneBoundaryFilterSchema>;

/**
 * Zone shell boundary envelope. Split from nav/theme/page so manage tabs can
 * persist independently and avoid cross-tab lost updates.
 */
export const zoneBoundaryV1Schema = t.Object(
  {
    schema: t.Literal(ZONE_BOUNDARY_SCHEMA),
    version: t.Literal(ZONE_BOUNDARY_V1_VERSION),
    context: zoneContextSchema,
    filters: zoneBoundaryFilterSchema,
  },
  { additionalProperties: false },
);

export type ZoneBoundaryV1 = Static<typeof zoneBoundaryV1Schema>;
export type ZoneBoundary = ZoneBoundaryV1;

const zoneBoundaryParser = createVersionedEnvelopeParser<ZoneBoundary>({
  schemaName: ZONE_BOUNDARY_SCHEMA,
  latestVersion: ZONE_BOUNDARY_V1_VERSION,
  latestSchema: zoneBoundaryV1Schema,
  versions: [
    {
      version: 1,
      schema: zoneBoundaryV1Schema,
      upgrade: (boundary) => boundary as ZoneBoundary,
    },
  ],
});

export const zoneBoundaryEnvelopeSchema = t.Union([zoneBoundaryV1Schema]);

export type ZoneBoundaryEnvelope = ZoneBoundary;

export function parseZoneBoundary(value: unknown): ZoneBoundary | null {
  return zoneBoundaryParser.parse(value);
}
