import { describe, expect, test } from "bun:test";
import { Value } from "@sinclair/typebox/value";
import {
  disabledRealmDockInsightWeightsDraftSchema,
  disabledRealmDockMemberAnalyticsDraftSchema,
  emptyRealmDock,
  parseRealmDock,
  realmDockItemSchema,
  realmDockPlacementSchema,
  realmDockV1Schema,
  realmDockWidgetSchema,
} from "./realm-dock";

const nodeId = "01972fd3-05e7-76cc-8ed9-41aa7d24a983";

describe("RealmDock", () => {
  test("accepts generic rezics/dock main/wiki placements with direct widgets", () => {
    expect(Value.Check(realmDockPlacementSchema, "main")).toBe(true);
    expect(Value.Check(realmDockPlacementSchema, "wiki")).toBe(true);
    expect(Value.Check(realmDockPlacementSchema, "home")).toBe(false);
    expect(Value.Check(realmDockPlacementSchema, "about")).toBe(false);

    expect(
      Value.Check(realmDockV1Schema, {
        schema: "rezics/dock",
        version: 1,
        placements: {
          main: [
            { kind: "unitDescription", nodeId },
            { kind: "unitSubscriptionStat", nodeId },
            { kind: "realmInfo", nodeId },
            { kind: "links", nodeId, items: [] },
            { kind: "realmRules", nodeId, mode: "summary" },
            { kind: "realmModerators", nodeId, limit: 5 },
            {
              kind: "richText",
              nodeId,
              titleOverrideUnitId: "label-1",
              contentUnitId: "post-1",
            },
          ],
          wiki: [{ kind: "zoneNav", nodeId, zoneUnitId: "zone-1" }],
        },
      }),
    ).toBe(true);
  });

  test("parses only docks with all required main widgets and host placements", () => {
    expect(parseRealmDock(emptyRealmDock())).not.toBeNull();
    expect(
      parseRealmDock({
        schema: "rezics/dock",
        version: 1,
        placements: {
          main: [
            { kind: "unitDescription", nodeId },
            { kind: "unitSubscriptionStat", nodeId },
            { kind: "realmInfo", nodeId },
            { kind: "links", nodeId, items: [] },
            { kind: "realmRules", nodeId },
          ],
        },
      }),
    ).toBeNull();
    expect(
      parseRealmDock({
        schema: "rezics/dock",
        version: 1,
        placements: {
          sidebar: [],
          main: emptyRealmDock().placements.main,
        },
      }),
    ).toBeNull();
  });

  test("accepts active widget variants with override references only", () => {
    const widgets = [
      { kind: "richText", nodeId, contentUnitId: "post-1" },
      {
        kind: "buttonLinks",
        nodeId,
        items: [
          {
            labelOverrideUnitId: "label-1",
            target: { kind: "unit", unitId: "u-1" },
          },
        ],
      },
      {
        kind: "imageLinks",
        nodeId,
        items: [{ imageUrl: "https://img.example/a.png" }],
      },
      {
        kind: "featuredUnit",
        nodeId,
        unitId: "realm-1",
        unitType: "REALM",
      },
      { kind: "realmCalendar", nodeId, source: "realmPosts" },
      { kind: "zoneNav", nodeId, zoneUnitId: "zone-1", menuSlug: "main" },
      { kind: "realmStats", nodeId, metrics: ["members", "posts"] },
      { kind: "pinboard", nodeId, placement: "home" },
    ];

    for (const widget of widgets) {
      expect(Value.Check(realmDockWidgetSchema, widget)).toBe(true);
      expect(Value.Check(realmDockItemSchema, widget)).toBe(true);
    }
  });

  test("rejects old wrappers, ids, keys, and unknown widget kinds", () => {
    expect(
      Value.Check(realmDockWidgetSchema, {
        kind: "richText",
        id: "text",
        contentUnitId: "post-1",
      }),
    ).toBe(false);
    expect(
      Value.Check(realmDockItemSchema, {
        slot: "widget",
        id: "text",
        widget: { kind: "richText", nodeId, contentUnitId: "post-1" },
      }),
    ).toBe(false);
    expect(
      Value.Check(realmDockWidgetSchema, {
        kind: "legacyNotice",
        pinboardKey: "home",
      }),
    ).toBe(false);
    expect(
      Value.Check(realmDockWidgetSchema, {
        kind: "pinboard",
        nodeId,
        pinboardKey: "home",
      }),
    ).toBe(false);
  });

  test("keeps insight weights and member analytics as disabled drafts", () => {
    expect(
      Value.Check(disabledRealmDockInsightWeightsDraftSchema, {
        kind: "insightWeights",
        items: [{ metricKey: "activeNow" }],
      }),
    ).toBe(true);
    expect(
      Value.Check(disabledRealmDockMemberAnalyticsDraftSchema, {
        kind: "memberAnalytics",
        sections: ["topMembers"],
      }),
    ).toBe(true);
    expect(
      Value.Check(realmDockWidgetSchema, {
        kind: "insightWeights",
        items: [{ metricKey: "activeNow" }],
      }),
    ).toBe(false);
    expect(
      Value.Check(realmDockWidgetSchema, {
        kind: "memberAnalytics",
        sections: ["topMembers"],
      }),
    ).toBe(false);
  });
});
