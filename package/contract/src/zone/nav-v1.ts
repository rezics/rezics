import type { Static } from "elysia";
import { t } from "elysia";
import { createVersionedEnvelopeParser } from "../envelope/envelope";
import { type ZoneMenu, zoneMenuSchema } from "./menu";

export const ZONE_NAV_SCHEMA = "rezics/zone-nav" as const;
export const ZONE_NAV_V1_VERSION = 1 as const;

const httpsUrlSchema = t.String({ pattern: "^https://" });

export const zoneHeaderSchema = t.Object(
  {
    menuSlug: t.String({ minLength: 1 }),
    logoImageUrl: t.Optional(httpsUrlSchema),
    searchPlaceholderLabelUnitId: t.Optional(t.String({ minLength: 1 })),
  },
  { additionalProperties: false },
);

export type ZoneHeader = Static<typeof zoneHeaderSchema>;

/**
 * Navigation remains JSON because menus are recursive whole-tree documents,
 * capped at three levels, and never queried by node. `header.menuSlug`
 * validation stays in-envelope with the menu tree it references.
 */
export const zoneNavV1Schema = t.Object(
  {
    schema: t.Literal(ZONE_NAV_SCHEMA),
    version: t.Literal(ZONE_NAV_V1_VERSION),
    menus: t.Array(zoneMenuSchema),
    header: zoneHeaderSchema,
  },
  { additionalProperties: false },
);

export type ZoneNavV1 = Omit<Static<typeof zoneNavV1Schema>, "menus"> & {
  menus: ZoneMenu[];
};
export type ZoneNav = ZoneNavV1;

const zoneNavParser = createVersionedEnvelopeParser<ZoneNav>({
  schemaName: ZONE_NAV_SCHEMA,
  latestVersion: ZONE_NAV_V1_VERSION,
  latestSchema: zoneNavV1Schema,
  versions: [
    {
      version: 1,
      schema: zoneNavV1Schema,
      upgrade: (nav) => nav as ZoneNav,
    },
  ],
});

export const zoneNavEnvelopeSchema = t.Union([zoneNavV1Schema]);

export type ZoneNavEnvelope = ZoneNav;

export function parseZoneNav(value: unknown): ZoneNav | null {
  return zoneNavParser.parse(value);
}
