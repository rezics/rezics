import type { Static } from "elysia";
import { t } from "elysia";
import { createVersionedEnvelopeParser } from "../envelope/envelope";

export const ZONE_THEME_SCHEMA = "rezics/zone-theme" as const;
export const ZONE_THEME_V1_VERSION = 1 as const;

const httpsUrlSchema = t.String({ pattern: "^https://" });

export const zoneThemeV1Schema = t.Object(
  {
    schema: t.Literal(ZONE_THEME_SCHEMA),
    version: t.Literal(ZONE_THEME_V1_VERSION),
    tokens: t.Optional(
      t.Object(
        {
          background: t.Optional(t.String()),
          surface: t.Optional(t.String()),
          text: t.Optional(t.String()),
          mutedText: t.Optional(t.String()),
          accent: t.Optional(t.String()),
          accentText: t.Optional(t.String()),
        },
        { additionalProperties: false },
      ),
    ),
    images: t.Optional(
      t.Object(
        {
          logoUrl: t.Optional(httpsUrlSchema),
          bannerUrl: t.Optional(httpsUrlSchema),
          backgroundUrl: t.Optional(httpsUrlSchema),
        },
        { additionalProperties: false },
      ),
    ),
    layout: t.Optional(
      t.Object(
        {
          // Deliberately unclamped: bad values only affect that zone's
          // presentation, while author-controlled widths remain unrestricted.
          contentMaxWidth: t.Optional(t.Number()),
          density: t.Optional(
            t.Union([t.Literal("compact"), t.Literal("comfortable")]),
          ),
        },
        { additionalProperties: false },
      ),
    ),
  },
  { additionalProperties: false },
);

export type ZoneThemeV1 = Static<typeof zoneThemeV1Schema>;
export type ZoneTheme = ZoneThemeV1;

const zoneThemeParser = createVersionedEnvelopeParser<ZoneTheme>({
  schemaName: ZONE_THEME_SCHEMA,
  latestVersion: ZONE_THEME_V1_VERSION,
  latestSchema: zoneThemeV1Schema,
  versions: [
    {
      version: 1,
      schema: zoneThemeV1Schema,
      upgrade: (theme) => theme as ZoneTheme,
    },
  ],
});

export const zoneThemeEnvelopeSchema = t.Union([zoneThemeV1Schema]);

export type ZoneThemeEnvelope = ZoneTheme;

export function parseZoneTheme(value: unknown): ZoneTheme | null {
  return zoneThemeParser.parse(value);
}
