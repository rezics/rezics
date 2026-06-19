import type { Static } from "elysia";
import { t } from "elysia";
import {
  literalSchemaFromValues,
  schemaNodeIdSchema,
  schemaPlacementSchema,
} from "../schema";
import { UnitType, unitTypeSchema } from "../unit/unit";
import { zoneLinkTargetSchema } from "../zone/link-target";

export const dockWidgetKindValues = [
  "featuredUnit",
  "unitDescription",
  "unitSubscriptionStat",
  "realmInfo",
  "links",
  "richText",
  "buttonLinks",
  "imageLinks",
  "realmRules",
  "realmModerators",
  "realmStats",
  "realmCalendar",
  "zoneNav",
  "pinboard",
] as const;

export const dockWidgetKindSchema =
  literalSchemaFromValues(dockWidgetKindValues);

export type DockWidgetKind = (typeof dockWidgetKindValues)[number];

const dockWidgetBaseSchema = t.Object(
  {
    nodeId: schemaNodeIdSchema,
    titleOverrideUnitId: t.Optional(t.String({ minLength: 1 })),
  },
  { additionalProperties: false },
);

export const featuredUnitWidgetSchema = t.Object(
  {
    ...dockWidgetBaseSchema.properties,
    kind: t.Literal("featuredUnit"),
    unitId: t.String({ minLength: 1 }),
    unitType: t.Optional(unitTypeSchema),
  },
  { additionalProperties: false },
);

export const unitDescriptionWidgetSchema = t.Object(
  {
    ...dockWidgetBaseSchema.properties,
    kind: t.Literal("unitDescription"),
    maxLines: t.Optional(t.Number({ minimum: 1, maximum: 20 })),
  },
  { additionalProperties: false },
);

export const unitSubscriptionStatWidgetSchema = t.Object(
  {
    ...dockWidgetBaseSchema.properties,
    kind: t.Literal("unitSubscriptionStat"),
    labelOverrideUnitId: t.Optional(t.String({ minLength: 1 })),
  },
  { additionalProperties: false },
);

export const realmInfoWidgetSchema = t.Object(
  {
    ...dockWidgetBaseSchema.properties,
    kind: t.Literal("realmInfo"),
  },
  { additionalProperties: false },
);

export const dockLinkItemSchema = t.Object(
  {
    kind: t.Literal("link"),
    target: zoneLinkTargetSchema,
    labelOverrideUnitId: t.Optional(t.String({ minLength: 1 })),
  },
  { additionalProperties: false },
);

export const dockLinkGroupItemSchema = t.Object(
  {
    kind: t.Literal("group"),
    labelOverrideUnitId: t.Optional(t.String({ minLength: 1 })),
    items: t.Array(dockLinkItemSchema),
  },
  { additionalProperties: false },
);

export const dockLinkListItemSchema = t.Union([
  dockLinkItemSchema,
  dockLinkGroupItemSchema,
]);

export type DockLinkListItem = Static<typeof dockLinkListItemSchema>;

export const linksWidgetSchema = t.Object(
  {
    ...dockWidgetBaseSchema.properties,
    kind: t.Literal("links"),
    items: t.Array(dockLinkListItemSchema),
  },
  { additionalProperties: false },
);

export const richTextWidgetSchema = t.Object(
  {
    ...dockWidgetBaseSchema.properties,
    kind: t.Literal("richText"),
    contentUnitId: t.String({ minLength: 1 }),
  },
  { additionalProperties: false },
);

export const dockButtonLinkItemSchema = t.Object(
  {
    labelOverrideUnitId: t.Optional(t.String({ minLength: 1 })),
    target: zoneLinkTargetSchema,
  },
  { additionalProperties: false },
);

export type DockButtonLinkItem = Static<typeof dockButtonLinkItemSchema>;

export const buttonLinksWidgetSchema = t.Object(
  {
    ...dockWidgetBaseSchema.properties,
    kind: t.Literal("buttonLinks"),
    items: t.Array(dockButtonLinkItemSchema),
  },
  { additionalProperties: false },
);

export const dockImageLinkItemSchema = t.Object(
  {
    imageUrl: t.String({ pattern: "^https://" }),
    altOverrideUnitId: t.Optional(t.String({ minLength: 1 })),
    target: t.Optional(zoneLinkTargetSchema),
  },
  { additionalProperties: false },
);

export type DockImageLinkItem = Static<typeof dockImageLinkItemSchema>;

export const imageLinksWidgetSchema = t.Object(
  {
    ...dockWidgetBaseSchema.properties,
    kind: t.Literal("imageLinks"),
    items: t.Array(dockImageLinkItemSchema),
  },
  { additionalProperties: false },
);

export const realmRulesWidgetSchema = t.Object(
  {
    ...dockWidgetBaseSchema.properties,
    kind: t.Literal("realmRules"),
    mode: t.Optional(t.Union([t.Literal("summary"), t.Literal("full")])),
  },
  { additionalProperties: false },
);

export const realmModeratorsWidgetSchema = t.Object(
  {
    ...dockWidgetBaseSchema.properties,
    kind: t.Literal("realmModerators"),
    limit: t.Optional(t.Number({ minimum: 1, maximum: 20 })),
  },
  { additionalProperties: false },
);

export const realmStatsMetricValues = [
  "members",
  "posts",
  "wikiPages",
] as const;

export const realmStatsMetricSchema = literalSchemaFromValues(
  realmStatsMetricValues,
);

export type RealmStatsMetric = (typeof realmStatsMetricValues)[number];

export const realmStatsWidgetSchema = t.Object(
  {
    ...dockWidgetBaseSchema.properties,
    kind: t.Literal("realmStats"),
    metrics: t.Array(realmStatsMetricSchema),
  },
  { additionalProperties: false },
);

export const realmCalendarWidgetSchema = t.Object(
  {
    ...dockWidgetBaseSchema.properties,
    kind: t.Literal("realmCalendar"),
    source: t.Optional(t.Literal("realmPosts")),
  },
  { additionalProperties: false },
);

export const zoneNavWidgetSchema = t.Object(
  {
    ...dockWidgetBaseSchema.properties,
    kind: t.Literal("zoneNav"),
    zoneUnitId: t.String({ minLength: 1 }),
    menuSlug: t.Optional(t.String({ minLength: 1 })),
  },
  { additionalProperties: false },
);

export const pinboardWidgetSchema = t.Object(
  {
    ...dockWidgetBaseSchema.properties,
    kind: t.Literal("pinboard"),
    placement: schemaPlacementSchema,
  },
  { additionalProperties: false },
);

export const dockWidgetSchemas = {
  featuredUnit: featuredUnitWidgetSchema,
  unitDescription: unitDescriptionWidgetSchema,
  unitSubscriptionStat: unitSubscriptionStatWidgetSchema,
  realmInfo: realmInfoWidgetSchema,
  links: linksWidgetSchema,
  richText: richTextWidgetSchema,
  buttonLinks: buttonLinksWidgetSchema,
  imageLinks: imageLinksWidgetSchema,
  realmRules: realmRulesWidgetSchema,
  realmModerators: realmModeratorsWidgetSchema,
  realmStats: realmStatsWidgetSchema,
  realmCalendar: realmCalendarWidgetSchema,
  zoneNav: zoneNavWidgetSchema,
  pinboard: pinboardWidgetSchema,
} as const;

export const dockWidgetSchema = t.Union([
  dockWidgetSchemas.featuredUnit,
  dockWidgetSchemas.unitDescription,
  dockWidgetSchemas.unitSubscriptionStat,
  dockWidgetSchemas.realmInfo,
  dockWidgetSchemas.links,
  dockWidgetSchemas.richText,
  dockWidgetSchemas.buttonLinks,
  dockWidgetSchemas.imageLinks,
  dockWidgetSchemas.realmRules,
  dockWidgetSchemas.realmModerators,
  dockWidgetSchemas.realmStats,
  dockWidgetSchemas.realmCalendar,
  dockWidgetSchemas.zoneNav,
  dockWidgetSchemas.pinboard,
]);

export type DockWidget = Static<typeof dockWidgetSchema>;

export const disabledDockInsightWeightsDraftSchema = t.Object(
  {
    kind: t.Literal("insightWeights"),
    items: t.Array(
      t.Object(
        {
          labelOverrideUnitId: t.Optional(t.String({ minLength: 1 })),
          metricKey: t.String({ minLength: 1 }),
        },
        { additionalProperties: false },
      ),
    ),
  },
  { additionalProperties: false },
);

export const disabledDockMemberAnalyticsDraftSchema = t.Object(
  {
    kind: t.Literal("memberAnalytics"),
    sections: t.Array(t.String({ minLength: 1 })),
  },
  { additionalProperties: false },
);

export const defaultRealmDockMainWidgetKinds = [
  "unitDescription",
  "unitSubscriptionStat",
  "realmInfo",
  "links",
  "realmRules",
  "realmModerators",
] as const satisfies readonly DockWidgetKind[];

export const featuredRealmUnitType = UnitType.REALM;
