import type { Static } from "elysia";
import { t } from "elysia";
import { createVersionedEnvelopeParser } from "../envelope/envelope";
import { pinboardKeySchema } from "../pinboard/pinboard";
import { zoneLinkTargetSchema } from "../zone/link-target";

export const REALM_SIDEBAR_SCHEMA = "rezics/realm-sidebar" as const;
export const REALM_SIDEBAR_V1_VERSION = 1 as const;

export const realmSidebarPlacementValues = ["home", "wiki", "about"] as const;

export const realmSidebarPlacementSchema = t.Union([
  t.Literal("home"),
  t.Literal("wiki"),
  t.Literal("about"),
]);

export type RealmSidebarPlacement = Static<typeof realmSidebarPlacementSchema>;

const realmSidebarWidgetBaseSchema = t.Object(
  {
    id: t.String({ minLength: 1 }),
    titleLabelUnitId: t.Optional(t.String({ minLength: 1 })),
  },
  { additionalProperties: false },
);

export const realmSidebarTextWidgetSchema = t.Object(
  {
    ...realmSidebarWidgetBaseSchema.properties,
    kind: t.Literal("text"),
    contentUnitId: t.String({ minLength: 1 }),
  },
  { additionalProperties: false },
);

export const realmSidebarRulesWidgetSchema = t.Object(
  {
    ...realmSidebarWidgetBaseSchema.properties,
    kind: t.Literal("rules"),
    mode: t.Optional(t.Union([t.Literal("summary"), t.Literal("full")])),
  },
  { additionalProperties: false },
);

export const realmSidebarButtonItemSchema = t.Object(
  {
    labelUnitId: t.String({ minLength: 1 }),
    target: zoneLinkTargetSchema,
  },
  { additionalProperties: false },
);

export type RealmSidebarButtonItem = Static<
  typeof realmSidebarButtonItemSchema
>;

export const realmSidebarButtonsWidgetSchema = t.Object(
  {
    ...realmSidebarWidgetBaseSchema.properties,
    kind: t.Literal("buttons"),
    items: t.Array(realmSidebarButtonItemSchema),
  },
  { additionalProperties: false },
);

export const realmSidebarImageItemSchema = t.Object(
  {
    imageUrl: t.String({ pattern: "^https://" }),
    altLabelUnitId: t.Optional(t.String({ minLength: 1 })),
    target: t.Optional(zoneLinkTargetSchema),
  },
  { additionalProperties: false },
);

export type RealmSidebarImageItem = Static<typeof realmSidebarImageItemSchema>;

export const realmSidebarImagesWidgetSchema = t.Object(
  {
    ...realmSidebarWidgetBaseSchema.properties,
    kind: t.Literal("images"),
    items: t.Array(realmSidebarImageItemSchema),
  },
  { additionalProperties: false },
);

export const realmSidebarCommunityListWidgetSchema = t.Object(
  {
    ...realmSidebarWidgetBaseSchema.properties,
    kind: t.Literal("communityList"),
    realmUnitIds: t.Array(t.String({ minLength: 1 })),
  },
  { additionalProperties: false },
);

export const realmSidebarCalendarWidgetSchema = t.Object(
  {
    ...realmSidebarWidgetBaseSchema.properties,
    kind: t.Literal("calendar"),
    source: t.Optional(t.Literal("realmPosts")),
  },
  { additionalProperties: false },
);

export const realmSidebarFeaturedZoneWidgetSchema = t.Object(
  {
    ...realmSidebarWidgetBaseSchema.properties,
    kind: t.Literal("featuredZone"),
    zoneUnitId: t.String({ minLength: 1 }),
  },
  { additionalProperties: false },
);

export const realmSidebarZoneNavWidgetSchema = t.Object(
  {
    ...realmSidebarWidgetBaseSchema.properties,
    kind: t.Literal("zoneNav"),
    zoneUnitId: t.String({ minLength: 1 }),
    menuId: t.Optional(t.String({ minLength: 1 })),
  },
  { additionalProperties: false },
);

export const realmSidebarStatsMetricSchema = t.Union([
  t.Literal("members"),
  t.Literal("posts"),
  t.Literal("wikiPages"),
]);

export type RealmSidebarStatsMetric = Static<
  typeof realmSidebarStatsMetricSchema
>;

export const realmSidebarStatsWidgetSchema = t.Object(
  {
    ...realmSidebarWidgetBaseSchema.properties,
    kind: t.Literal("stats"),
    metrics: t.Array(realmSidebarStatsMetricSchema),
  },
  { additionalProperties: false },
);

export const realmSidebarPinboardWidgetSchema = t.Object(
  {
    ...realmSidebarWidgetBaseSchema.properties,
    kind: t.Literal("pinboard"),
    pinboardKey: pinboardKeySchema,
  },
  { additionalProperties: false },
);

export const realmSidebarWidgetSchema = t.Union([
  realmSidebarTextWidgetSchema,
  realmSidebarRulesWidgetSchema,
  realmSidebarButtonsWidgetSchema,
  realmSidebarImagesWidgetSchema,
  realmSidebarCommunityListWidgetSchema,
  realmSidebarCalendarWidgetSchema,
  realmSidebarFeaturedZoneWidgetSchema,
  realmSidebarZoneNavWidgetSchema,
  realmSidebarStatsWidgetSchema,
  realmSidebarPinboardWidgetSchema,
]);

export type RealmSidebarWidget = Static<typeof realmSidebarWidgetSchema>;

export const realmSidebarPlacementsSchema = t.Object(
  {
    home: t.Optional(t.Array(realmSidebarWidgetSchema)),
    wiki: t.Optional(t.Array(realmSidebarWidgetSchema)),
    about: t.Optional(t.Array(realmSidebarWidgetSchema)),
  },
  { additionalProperties: false },
);

export type RealmSidebarPlacements = Static<
  typeof realmSidebarPlacementsSchema
>;

export const realmSidebarV1Schema = t.Object(
  {
    schema: t.Literal(REALM_SIDEBAR_SCHEMA),
    version: t.Literal(REALM_SIDEBAR_V1_VERSION),
    placements: realmSidebarPlacementsSchema,
  },
  { additionalProperties: false },
);

export type RealmSidebarV1 = Static<typeof realmSidebarV1Schema>;
export type RealmSidebar = RealmSidebarV1;

const realmSidebarParser = createVersionedEnvelopeParser<RealmSidebar>({
  schemaName: REALM_SIDEBAR_SCHEMA,
  latestVersion: REALM_SIDEBAR_V1_VERSION,
  latestSchema: realmSidebarV1Schema,
  versions: [
    {
      version: 1,
      schema: realmSidebarV1Schema,
      upgrade: (sidebar) => sidebar as RealmSidebar,
    },
  ],
});

export const realmSidebarEnvelopeSchema = t.Union([realmSidebarV1Schema]);

export type RealmSidebarEnvelope = RealmSidebar;

export function parseRealmSidebar(value: unknown): RealmSidebar | null {
  return realmSidebarParser.parse(value);
}

export function emptyRealmSidebar(): RealmSidebar {
  return {
    schema: REALM_SIDEBAR_SCHEMA,
    version: REALM_SIDEBAR_V1_VERSION,
    placements: {},
  };
}
