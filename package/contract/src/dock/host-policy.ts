import { t } from "elysia";
import { Value } from "@sinclair/typebox/value";
import {
  literalSchemaFromValues,
  schemaNodeIdSchema,
  type SchemaNodeId,
} from "../schema";
import {
  defaultRealmDockMainWidgetKinds,
  dockWidgetSchema,
  dockWidgetSchemas,
  type DockWidget,
  type DockWidgetKind,
} from "./widgets";

export const realmDockPlacementValues = ["main", "wiki"] as const;
export type RealmDockPlacement = (typeof realmDockPlacementValues)[number];
export const realmDockPlacementSchema = literalSchemaFromValues(
  realmDockPlacementValues,
);

export type CatalogDockPlacement = "main";
export const catalogDockPlacementSchema = t.Literal("main");

export const realmMainDockWidgetSchema = t.Union([
  dockWidgetSchemas.unitDescription,
  dockWidgetSchemas.unitSubscriptionStat,
  dockWidgetSchemas.realmInfo,
  dockWidgetSchemas.links,
  dockWidgetSchemas.richText,
  dockWidgetSchemas.buttonLinks,
  dockWidgetSchemas.imageLinks,
  dockWidgetSchemas.featuredUnit,
  dockWidgetSchemas.realmRules,
  dockWidgetSchemas.realmModerators,
  dockWidgetSchemas.realmStats,
  dockWidgetSchemas.realmCalendar,
  dockWidgetSchemas.pinboard,
]);

export const realmWikiDockWidgetSchema = t.Union([
  dockWidgetSchemas.zoneNav,
  dockWidgetSchemas.links,
  dockWidgetSchemas.richText,
  dockWidgetSchemas.buttonLinks,
  dockWidgetSchemas.imageLinks,
]);

export type DockHostPolicy = {
  widgetSchema: typeof dockWidgetSchema;
  requiredKinds?: readonly DockWidgetKind[];
  lockedKinds?: readonly DockWidgetKind[];
  maxWidgets: number;
};

export const realmDockPolicy = {
  main: {
    widgetSchema: realmMainDockWidgetSchema,
    requiredKinds: defaultRealmDockMainWidgetKinds,
    lockedKinds: defaultRealmDockMainWidgetKinds,
    maxWidgets: 32,
  },
  wiki: {
    widgetSchema: realmWikiDockWidgetSchema,
    maxWidgets: 16,
  },
} as const;

export function isRealmDockPlacement(
  placement: string,
): placement is RealmDockPlacement {
  return (realmDockPlacementValues as readonly string[]).includes(placement);
}

export function isValidRealmDockPlacementWidgets(
  placement: RealmDockPlacement,
  widgets: readonly DockWidget[],
): boolean {
  const policy = realmDockPolicy[placement];
  if (widgets.length > policy.maxWidgets) return false;

  for (const widget of widgets) {
    if (!Value.Check(policy.widgetSchema, widget)) return false;
  }

  const required = new Set(policy.requiredKinds ?? []);
  for (const widget of widgets) required.delete(widget.kind);
  return required.size === 0;
}

export function systemDockNodeId(kind: DockWidgetKind): SchemaNodeId {
  const index = defaultRealmDockMainWidgetKinds.indexOf(kind);
  const suffix = String(Math.max(index, 0) + 1).padStart(12, "0");
  return `00000000-0000-7000-8000-${suffix}`;
}

export function defaultRealmDockMainWidgets(): DockWidget[] {
  return [
    { kind: "unitDescription", nodeId: systemDockNodeId("unitDescription") },
    {
      kind: "unitSubscriptionStat",
      nodeId: systemDockNodeId("unitSubscriptionStat"),
    },
    { kind: "realmInfo", nodeId: systemDockNodeId("realmInfo") },
    { kind: "links", nodeId: systemDockNodeId("links"), items: [] },
    {
      kind: "realmRules",
      nodeId: systemDockNodeId("realmRules"),
      mode: "summary",
    },
    {
      kind: "realmModerators",
      nodeId: systemDockNodeId("realmModerators"),
      limit: 5,
    },
  ];
}

Value.Check(schemaNodeIdSchema, systemDockNodeId("links"));
