import { describe, expect, test } from "bun:test";
import { Value } from "@sinclair/typebox/value";
import {
  disabledRealmDockInsightWeightsDraftSchema,
  disabledRealmDockMemberAnalyticsDraftSchema,
  emptyRealmDock,
  parseRealmDock,
  realmDockItemSchema,
  realmDockPlacementSchema,
  realmDockWidgetSchema,
  realmDockV1Schema,
} from "./realm-dock";

describe("RealmDock", () => {
  test("accepts v1 main/wiki placements with ordered items", () => {
    expect(Value.Check(realmDockPlacementSchema, "main")).toBe(true);
    expect(Value.Check(realmDockPlacementSchema, "wiki")).toBe(true);
    expect(Value.Check(realmDockPlacementSchema, "home")).toBe(false);
    expect(Value.Check(realmDockPlacementSchema, "about")).toBe(false);

    expect(
      Value.Check(realmDockV1Schema, {
        schema: "rezics/realm-dock",
        version: 1,
        placements: {
          main: [
            { slot: "builtin", id: "description" },
            { slot: "builtin", id: "subscriptionStat" },
            { slot: "builtin", id: "realmFacts" },
            { slot: "builtin", id: "bookmarks", items: [] },
            { slot: "builtin", id: "rules", mode: "summary" },
            { slot: "builtin", id: "moderators", limit: 5 },
            {
              slot: "widget",
              id: "text",
              widget: {
                kind: "text",
                titleOverrideUnitId: "label-1",
                contentUnitId: "post-1",
              },
            },
          ],
          wiki: [
            {
              slot: "widget",
              id: "nav",
              widget: { kind: "zoneNav", zoneUnitId: "zone-1" },
            },
          ],
        },
      }),
    ).toBe(true);
  });

  test("parses only docks with all required main builtins and unique item ids", () => {
    expect(parseRealmDock(emptyRealmDock())).not.toBeNull();
    expect(
      parseRealmDock({
        schema: "rezics/realm-dock",
        version: 1,
        placements: {
          main: [
            { slot: "builtin", id: "description" },
            { slot: "builtin", id: "subscriptionStat" },
            { slot: "builtin", id: "realmFacts" },
            { slot: "builtin", id: "bookmarks", items: [] },
            { slot: "builtin", id: "rules" },
          ],
        },
      }),
    ).toBeNull();
    expect(
      parseRealmDock({
        schema: "rezics/realm-dock",
        version: 1,
        placements: {
          main: [
            { slot: "builtin", id: "description" },
            { slot: "builtin", id: "description" },
            { slot: "builtin", id: "subscriptionStat" },
            { slot: "builtin", id: "realmFacts" },
            { slot: "builtin", id: "bookmarks", items: [] },
            { slot: "builtin", id: "rules" },
            { slot: "builtin", id: "moderators" },
          ],
        },
      }),
    ).toBeNull();
  });

  test("accepts active custom widget variants with override references only", () => {
    const widgets = [
      { kind: "text", contentUnitId: "post-1" },
      {
        kind: "buttons",
        items: [
          {
            labelOverrideUnitId: "label-1",
            target: { kind: "unit", unitId: "u-1" },
          },
        ],
      },
      {
        kind: "images",
        items: [{ imageUrl: "https://img.example/a.png" }],
      },
      {
        kind: "communityList",
        realmUnitIds: ["realm-1"],
      },
      { kind: "calendar", source: "realmPosts" },
      { kind: "featuredZone", zoneUnitId: "zone-1" },
      { kind: "zoneNav", zoneUnitId: "zone-1", menuId: "main" },
      { kind: "stats", metrics: ["members", "posts"] },
      { kind: "pinboard", pinboardKey: "home" },
    ];

    for (const widget of widgets) {
      expect(Value.Check(realmDockWidgetSchema, widget)).toBe(true);
      expect(
        Value.Check(realmDockItemSchema, {
          slot: "widget",
          id: widget.kind,
          widget,
        }),
      ).toBe(true);
    }
  });

  test("rejects persisted app i18n keys and unknown widget kinds", () => {
    expect(
      Value.Check(realmDockWidgetSchema, {
        kind: "text",
        labelKeyDefault: "entity:realm_dock_widget_text",
        contentUnitId: "post-1",
      }),
    ).toBe(false);
    expect(
      Value.Check(realmDockWidgetSchema, {
        kind: "legacyNotice",
        pinboardKey: "home",
      }),
    ).toBe(false);
  });

  test("keeps insight weights and member analytics as disabled drafts", () => {
    expect(
      Value.Check(disabledRealmDockInsightWeightsDraftSchema, {
        kind: "insightWeights",
        items: [{ id: "active", metricKey: "activeNow" }],
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
        items: [{ id: "active", metricKey: "activeNow" }],
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
