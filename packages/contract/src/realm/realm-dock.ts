import type { Static } from "elysia";
import { t } from "elysia";
import { Value } from "@sinclair/typebox/value";
import { createVersionedEnvelopeParser } from "../envelope/envelope";
import { pinboardKeySchema } from "../pinboard/pinboard";
import { zoneLinkTargetSchema } from "../zone/link-target";

export const REALM_DOCK_SCHEMA = "rezics/realm-dock" as const;
export const REALM_DOCK_V1_VERSION = 1 as const;

export const realmDockPlacementValues = ["main", "wiki"] as const;

export const realmDockPlacementSchema = t.Union([
  t.Literal("main"),
  t.Literal("wiki"),
]);

export type RealmDockPlacement = Static<typeof realmDockPlacementSchema>;

export const realmDockBuiltinIdValues = [
  "description",
  "subscriptionStat",
  "realmFacts",
  "bookmarks",
  "rules",
  "moderators",
] as const;

export const realmDockMainRequiredBuiltinIds = [
  "description",
  "subscriptionStat",
  "realmFacts",
  "bookmarks",
  "rules",
  "moderators",
] as const;

export const realmDockBuiltinIdSchema = t.Union([
  t.Literal("description"),
  t.Literal("subscriptionStat"),
  t.Literal("realmFacts"),
  t.Literal("bookmarks"),
  t.Literal("rules"),
  t.Literal("moderators"),
]);

export type RealmDockBuiltinId = Static<typeof realmDockBuiltinIdSchema>;

const dockItemBaseSchema = t.Object(
  {
    id: t.String({ minLength: 1 }),
  },
  { additionalProperties: false },
);

export const realmDockDescriptionBuiltinItemSchema = t.Object(
  {
    ...dockItemBaseSchema.properties,
    slot: t.Literal("builtin"),
    id: t.Literal("description"),
    maxLines: t.Optional(t.Number({ minimum: 1, maximum: 20 })),
  },
  { additionalProperties: false },
);

export const realmDockSubscriptionStatBuiltinItemSchema = t.Object(
  {
    ...dockItemBaseSchema.properties,
    slot: t.Literal("builtin"),
    id: t.Literal("subscriptionStat"),
    labelOverrideUnitId: t.Optional(t.String({ minLength: 1 })),
  },
  { additionalProperties: false },
);

export const realmDockRealmFactsBuiltinItemSchema = t.Object(
  {
    ...dockItemBaseSchema.properties,
    slot: t.Literal("builtin"),
    id: t.Literal("realmFacts"),
  },
  { additionalProperties: false },
);

export const realmDockBookmarkLinkTargetSchema = t.Object(
  {
    id: t.String({ minLength: 1 }),
    labelOverrideUnitId: t.Optional(t.String({ minLength: 1 })),
    target: zoneLinkTargetSchema,
  },
  { additionalProperties: false },
);

export type RealmDockBookmarkLinkTarget = Static<
  typeof realmDockBookmarkLinkTargetSchema
>;

export const realmDockBookmarkDirectItemSchema = t.Object(
  {
    kind: t.Literal("link"),
    ...realmDockBookmarkLinkTargetSchema.properties,
  },
  { additionalProperties: false },
);

export const realmDockBookmarkGroupItemSchema = t.Object(
  {
    id: t.String({ minLength: 1 }),
    kind: t.Literal("group"),
    labelOverrideUnitId: t.Optional(t.String({ minLength: 1 })),
    items: t.Array(realmDockBookmarkLinkTargetSchema),
  },
  { additionalProperties: false },
);

export const realmDockBookmarkItemSchema = t.Union([
  realmDockBookmarkDirectItemSchema,
  realmDockBookmarkGroupItemSchema,
]);

export type RealmDockBookmarkItem = Static<typeof realmDockBookmarkItemSchema>;

export const realmDockBookmarksBuiltinItemSchema = t.Object(
  {
    ...dockItemBaseSchema.properties,
    slot: t.Literal("builtin"),
    id: t.Literal("bookmarks"),
    items: t.Array(realmDockBookmarkItemSchema),
  },
  { additionalProperties: false },
);

export const realmDockRulesBuiltinItemSchema = t.Object(
  {
    ...dockItemBaseSchema.properties,
    slot: t.Literal("builtin"),
    id: t.Literal("rules"),
    mode: t.Optional(t.Union([t.Literal("summary"), t.Literal("full")])),
  },
  { additionalProperties: false },
);

export const realmDockModeratorsBuiltinItemSchema = t.Object(
  {
    ...dockItemBaseSchema.properties,
    slot: t.Literal("builtin"),
    id: t.Literal("moderators"),
    limit: t.Optional(t.Number({ minimum: 1, maximum: 20 })),
  },
  { additionalProperties: false },
);

export const realmDockBuiltinItemSchema = t.Union([
  realmDockDescriptionBuiltinItemSchema,
  realmDockSubscriptionStatBuiltinItemSchema,
  realmDockRealmFactsBuiltinItemSchema,
  realmDockBookmarksBuiltinItemSchema,
  realmDockRulesBuiltinItemSchema,
  realmDockModeratorsBuiltinItemSchema,
]);

export type RealmDockBuiltinItem = Static<typeof realmDockBuiltinItemSchema>;

const realmDockWidgetBaseSchema = t.Object(
  {
    titleOverrideUnitId: t.Optional(t.String({ minLength: 1 })),
  },
  { additionalProperties: false },
);

export const realmDockTextWidgetSchema = t.Object(
  {
    ...realmDockWidgetBaseSchema.properties,
    kind: t.Literal("text"),
    contentUnitId: t.String({ minLength: 1 }),
  },
  { additionalProperties: false },
);

export const realmDockButtonItemSchema = t.Object(
  {
    labelOverrideUnitId: t.Optional(t.String({ minLength: 1 })),
    target: zoneLinkTargetSchema,
  },
  { additionalProperties: false },
);

export type RealmDockButtonItem = Static<typeof realmDockButtonItemSchema>;

export const realmDockButtonsWidgetSchema = t.Object(
  {
    ...realmDockWidgetBaseSchema.properties,
    kind: t.Literal("buttons"),
    items: t.Array(realmDockButtonItemSchema),
  },
  { additionalProperties: false },
);

export const realmDockImageItemSchema = t.Object(
  {
    imageUrl: t.String({ pattern: "^https://" }),
    altOverrideUnitId: t.Optional(t.String({ minLength: 1 })),
    target: t.Optional(zoneLinkTargetSchema),
  },
  { additionalProperties: false },
);

export type RealmDockImageItem = Static<typeof realmDockImageItemSchema>;

export const realmDockImagesWidgetSchema = t.Object(
  {
    ...realmDockWidgetBaseSchema.properties,
    kind: t.Literal("images"),
    items: t.Array(realmDockImageItemSchema),
  },
  { additionalProperties: false },
);

export const realmDockCommunityListWidgetSchema = t.Object(
  {
    ...realmDockWidgetBaseSchema.properties,
    kind: t.Literal("communityList"),
    realmUnitIds: t.Array(t.String({ minLength: 1 })),
  },
  { additionalProperties: false },
);

export const realmDockCalendarWidgetSchema = t.Object(
  {
    ...realmDockWidgetBaseSchema.properties,
    kind: t.Literal("calendar"),
    source: t.Optional(t.Literal("realmPosts")),
  },
  { additionalProperties: false },
);

export const realmDockFeaturedZoneWidgetSchema = t.Object(
  {
    ...realmDockWidgetBaseSchema.properties,
    kind: t.Literal("featuredZone"),
    zoneUnitId: t.String({ minLength: 1 }),
  },
  { additionalProperties: false },
);

export const realmDockZoneNavWidgetSchema = t.Object(
  {
    ...realmDockWidgetBaseSchema.properties,
    kind: t.Literal("zoneNav"),
    zoneUnitId: t.String({ minLength: 1 }),
    menuId: t.Optional(t.String({ minLength: 1 })),
  },
  { additionalProperties: false },
);

export const realmDockStatsMetricSchema = t.Union([
  t.Literal("members"),
  t.Literal("posts"),
  t.Literal("wikiPages"),
]);

export type RealmDockStatsMetric = Static<typeof realmDockStatsMetricSchema>;

export const realmDockStatsWidgetSchema = t.Object(
  {
    ...realmDockWidgetBaseSchema.properties,
    kind: t.Literal("stats"),
    metrics: t.Array(realmDockStatsMetricSchema),
  },
  { additionalProperties: false },
);

export const realmDockPinboardWidgetSchema = t.Object(
  {
    ...realmDockWidgetBaseSchema.properties,
    kind: t.Literal("pinboard"),
    pinboardKey: pinboardKeySchema,
  },
  { additionalProperties: false },
);

export const realmDockWidgetSchema = t.Union([
  realmDockTextWidgetSchema,
  realmDockButtonsWidgetSchema,
  realmDockImagesWidgetSchema,
  realmDockCommunityListWidgetSchema,
  realmDockCalendarWidgetSchema,
  realmDockFeaturedZoneWidgetSchema,
  realmDockZoneNavWidgetSchema,
  realmDockStatsWidgetSchema,
  realmDockPinboardWidgetSchema,
]);

export type RealmDockWidget = Static<typeof realmDockWidgetSchema>;

export const realmDockCustomWidgetItemSchema = t.Object(
  {
    ...dockItemBaseSchema.properties,
    slot: t.Literal("widget"),
    widget: realmDockWidgetSchema,
  },
  { additionalProperties: false },
);

export type RealmDockCustomWidgetItem = Static<
  typeof realmDockCustomWidgetItemSchema
>;

export const realmDockItemSchema = t.Union([
  realmDockBuiltinItemSchema,
  realmDockCustomWidgetItemSchema,
]);

export type RealmDockItem = Static<typeof realmDockItemSchema>;

export const realmDockPlacementsSchema = t.Object(
  {
    main: t.Optional(t.Array(realmDockItemSchema)),
    wiki: t.Optional(t.Array(realmDockItemSchema)),
  },
  { additionalProperties: false },
);

export type RealmDockPlacements = Static<typeof realmDockPlacementsSchema>;

export const realmDockV1Schema = t.Object(
  {
    schema: t.Literal(REALM_DOCK_SCHEMA),
    version: t.Literal(REALM_DOCK_V1_VERSION),
    placements: realmDockPlacementsSchema,
  },
  { additionalProperties: false },
);

export type RealmDockV1 = Static<typeof realmDockV1Schema>;
export type RealmDock = RealmDockV1;

const realmDockParser = createVersionedEnvelopeParser<RealmDock>({
  schemaName: REALM_DOCK_SCHEMA,
  latestVersion: REALM_DOCK_V1_VERSION,
  latestSchema: realmDockV1Schema,
  versions: [
    {
      version: 1,
      schema: realmDockV1Schema,
      upgrade: (dock) => dock as RealmDock,
    },
  ],
});

export const realmDockEnvelopeSchema = t.Union([realmDockV1Schema]);

export type RealmDockEnvelope = RealmDock;

/**
 * Draft-only insight shape. It is intentionally not included in
 * `realmDockWidgetSchema` until insight data sources and rendering behavior
 * exist; public UI must not fake Reddit-style weighted insight values.
 */
export const disabledRealmDockInsightWeightsDraftSchema = t.Object(
  {
    kind: t.Literal("insightWeights"),
    items: t.Array(
      t.Object(
        {
          id: t.String({ minLength: 1 }),
          labelOverrideUnitId: t.Optional(t.String({ minLength: 1 })),
          metricKey: t.String({ minLength: 1 }),
        },
        { additionalProperties: false },
      ),
    ),
  },
  { additionalProperties: false },
);

/**
 * Draft-only member analytics shape. It is intentionally not included in
 * `realmDockWidgetSchema`; moderator identity belongs to the `moderators`
 * builtin, not future member analytics/directory surfaces.
 */
export const disabledRealmDockMemberAnalyticsDraftSchema = t.Object(
  {
    kind: t.Literal("memberAnalytics"),
    sections: t.Array(t.String({ minLength: 1 })),
  },
  { additionalProperties: false },
);

export function parseRealmDock(value: unknown): RealmDock | null {
  const dock = realmDockParser.parse(value);
  if (!dock || !isValidRealmDock(dock)) return null;
  return dock;
}

export function isValidRealmDock(dock: RealmDock): boolean {
  if (!Value.Check(realmDockV1Schema, dock)) return false;
  return (
    validatePlacement(dock.placements.main ?? [], true).ok &&
    validatePlacement(dock.placements.wiki ?? [], false).ok
  );
}

export function emptyRealmDock(): RealmDock {
  return {
    schema: REALM_DOCK_SCHEMA,
    version: REALM_DOCK_V1_VERSION,
    placements: {
      main: defaultRealmDockMainItems(),
    },
  };
}

export function defaultRealmDockMainItems(): RealmDockBuiltinItem[] {
  return [
    { slot: "builtin", id: "description" },
    { slot: "builtin", id: "subscriptionStat" },
    { slot: "builtin", id: "realmFacts" },
    { slot: "builtin", id: "bookmarks", items: [] },
    { slot: "builtin", id: "rules", mode: "summary" },
    { slot: "builtin", id: "moderators", limit: 5 },
  ];
}

function validatePlacement(
  items: readonly RealmDockItem[],
  requireMainBuiltins: boolean,
): { ok: boolean } {
  const seen = new Set<string>();
  const required = requireMainBuiltins
    ? new Set<string>(realmDockMainRequiredBuiltinIds)
    : null;

  for (const item of items) {
    if (seen.has(item.id)) return { ok: false };
    seen.add(item.id);
    if (item.slot === "builtin") required?.delete(item.id);
  }

  return { ok: !required || required.size === 0 };
}
