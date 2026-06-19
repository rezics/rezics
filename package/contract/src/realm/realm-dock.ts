import { Value } from "@sinclair/typebox/value";
import type { Static } from "elysia";
import { t } from "elysia";
import {
  DOCK_SCHEMA,
  DOCK_V1_VERSION,
  defaultRealmDockMainWidgets,
  disabledDockInsightWeightsDraftSchema,
  disabledDockMemberAnalyticsDraftSchema,
  dockEnvelopeSchema,
  dockV1Schema,
  dockWidgetSchema,
  dockWidgetSchemas,
  isRealmDockPlacement,
  isValidRealmDockPlacementWidgets,
  parseDock,
  realmDockPlacementSchema,
  realmDockPlacementValues,
  realmDockPolicy,
  realmStatsMetricSchema,
  type Dock,
  type DockWidget,
  type DockWidgetKind,
  type RealmDockPlacement,
} from "../dock";

export const REALM_DOCK_SCHEMA = DOCK_SCHEMA;
export const REALM_DOCK_V1_VERSION = DOCK_V1_VERSION;

export {
  disabledDockInsightWeightsDraftSchema as disabledRealmDockInsightWeightsDraftSchema,
  disabledDockMemberAnalyticsDraftSchema as disabledRealmDockMemberAnalyticsDraftSchema,
  dockWidgetSchema as realmDockItemSchema,
  dockWidgetSchema as realmDockWidgetSchema,
  dockV1Schema as realmDockV1Schema,
  dockEnvelopeSchema as realmDockEnvelopeSchema,
  dockWidgetSchemas,
  realmDockPlacementSchema,
  realmDockPlacementValues,
  realmDockPolicy,
  realmStatsMetricSchema as realmDockStatsMetricSchema,
};

export type RealmDock = Dock;
export type RealmDockV1 = Dock;
export type RealmDockEnvelope = Dock;
export type RealmDockItem = DockWidget;
export type RealmDockWidget = DockWidget;
export type RealmDockWidgetKind = DockWidgetKind;
export type RealmDockStatsMetric = Static<typeof realmStatsMetricSchema>;

export const realmDockMainRequiredWidgetKinds = [
  "unitDescription",
  "unitSubscriptionStat",
  "realmInfo",
  "links",
  "realmRules",
  "realmModerators",
] as const satisfies readonly DockWidgetKind[];

export const realmDockMainLockedWidgetKinds = realmDockMainRequiredWidgetKinds;

export function parseRealmDock(value: unknown): RealmDock | null {
  const dock = parseDock(value);
  if (!dock || !isValidRealmDock(dock)) return null;
  return dock;
}

export function isValidRealmDock(dock: RealmDock): boolean {
  if (!Value.Check(dockV1Schema, dock)) return false;

  for (const placement of Object.keys(dock.placements)) {
    if (!isRealmDockPlacement(placement)) return false;
  }

  return realmDockPlacementValues.every((placement) =>
    isValidRealmDockPlacementWidgets(
      placement,
      dock.placements[placement] ?? [],
    ),
  );
}

export function emptyRealmDock(): RealmDock {
  return {
    schema: DOCK_SCHEMA,
    version: DOCK_V1_VERSION,
    placements: {
      main: defaultRealmDockMainWidgets(),
    },
  };
}

export function defaultRealmDockMainItems(): RealmDockItem[] {
  return defaultRealmDockMainWidgets();
}

export const realmDockPlacementsSchema = t.Object(
  {
    main: t.Optional(t.Array(dockWidgetSchema)),
    wiki: t.Optional(t.Array(dockWidgetSchema)),
  },
  { additionalProperties: false },
);

export type RealmDockPlacements = Static<typeof realmDockPlacementsSchema>;
