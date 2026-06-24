import type { Static } from "elysia";
import { t } from "elysia";
import { createVersionedEnvelopeParser } from "../envelope/envelope";
import { zonePageSectionSchema } from "./section";

export const ZONE_PAGE_SCHEMA = "rezics/zone-page" as const;
export const ZONE_PAGE_V1_VERSION = 1 as const;

/**
 * A zone page is a section layout container. A single richText section pointing
 * at a wiki post is a degenerate aggregation case, not a parallel page model.
 * Sections stay inside the page envelope because tabs/columns make them a
 * tree and they are always loaded with their page.
 */
export const zonePageV1Schema = t.Object(
  {
    schema: t.Literal(ZONE_PAGE_SCHEMA),
    version: t.Literal(ZONE_PAGE_V1_VERSION),
    sections: t.Array(zonePageSectionSchema),
  },
  { additionalProperties: false },
);

export type ZonePageV1 = Static<typeof zonePageV1Schema>;
export type ZonePage = ZonePageV1;

const zonePageParser = createVersionedEnvelopeParser<ZonePage>({
  schemaName: ZONE_PAGE_SCHEMA,
  latestVersion: ZONE_PAGE_V1_VERSION,
  latestSchema: zonePageV1Schema,
  versions: [
    {
      version: 1,
      schema: zonePageV1Schema,
      upgrade: (page) => page as ZonePage,
    },
  ],
});

export const zonePageEnvelopeSchema = t.Union([zonePageV1Schema]);

export type ZonePageEnvelope = ZonePage;

export function parseZonePage(value: unknown): ZonePage | null {
  return zonePageParser.parse(value);
}
