import { t } from "elysia";
import type { Static } from "elysia";
import { SlugRefSchema } from "./common/slug-ref";

// ANCHOR: Zone Filters

export const ZoneFiltersSchema = t.Object({
  type: t.Optional(t.Union([t.String(), t.Array(t.String())])),
  tags: t.Optional(t.Array(SlugRefSchema)),
  realmId: t.Optional(t.String()),
  nsfw: t.Optional(t.Boolean()),
  isLicensed: t.Optional(t.Boolean()),
  languages: t.Optional(t.Array(t.String())),
});

export type ZoneFilters = Static<typeof ZoneFiltersSchema>;

// ANCHOR: Zone DTO

export const ZoneDTOSchema = t.Object({
  slug: t.String(),
  name: t.String(),
  description: t.Optional(t.Union([t.String(), t.Null()])),
  filters: ZoneFiltersSchema,
  template: t.String(),
  styling: t.Optional(t.Union([t.Object({}), t.Null()])),
  startsAt: t.Optional(t.Union([t.String(), t.Null()])),
  endsAt: t.Optional(t.Union([t.String(), t.Null()])),
});

export type ZoneDTO = Static<typeof ZoneDTOSchema>;
