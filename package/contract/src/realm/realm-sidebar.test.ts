import { describe, expect, test } from "bun:test";
import { Value } from "@sinclair/typebox/value";
import {
  realmSidebarPlacementSchema,
  realmSidebarWidgetSchema,
  realmSidebarV1Schema,
} from "./realm-sidebar";

describe("RealmSidebar", () => {
  test("accepts v1 placements with ordered widgets", () => {
    expect(Value.Check(realmSidebarPlacementSchema, "home")).toBe(true);
    expect(
      Value.Check(realmSidebarV1Schema, {
        schema: "rezics/realm-sidebar",
        version: 1,
        placements: {
          home: [
            { id: "rules", kind: "rules", mode: "summary" },
            {
              id: "text",
              kind: "text",
              titleLabelUnitId: "label-1",
              contentUnitId: "post-1",
            },
          ],
          wiki: [{ id: "nav", kind: "zoneNav", zoneUnitId: "zone-1" }],
          about: [{ id: "stats", kind: "stats", metrics: ["members"] }],
        },
      }),
    ).toBe(true);
  });

  test("accepts all v1 widget variants", () => {
    const widgets = [
      { id: "text", kind: "text", contentUnitId: "post-1" },
      { id: "rules", kind: "rules" },
      {
        id: "buttons",
        kind: "buttons",
        items: [
          { labelUnitId: "label-1", target: { kind: "unit", unitId: "u-1" } },
        ],
      },
      {
        id: "images",
        kind: "images",
        items: [{ imageUrl: "https://img.example/a.png" }],
      },
      {
        id: "communities",
        kind: "communityList",
        realmUnitIds: ["realm-1"],
      },
      { id: "calendar", kind: "calendar", source: "realmPosts" },
      { id: "zone", kind: "featuredZone", zoneUnitId: "zone-1" },
      { id: "nav", kind: "zoneNav", zoneUnitId: "zone-1", menuId: "main" },
      { id: "stats", kind: "stats", metrics: ["members", "posts"] },
      { id: "pinboard", kind: "pinboard", pinboardKey: "home" },
    ];

    for (const widget of widgets) {
      expect(Value.Check(realmSidebarWidgetSchema, widget)).toBe(true);
    }
  });

  test("rejects inline custom text and unknown widget kinds", () => {
    expect(
      Value.Check(realmSidebarWidgetSchema, {
        id: "text",
        kind: "text",
        title: "Inline title",
        contentUnitId: "post-1",
      }),
    ).toBe(false);
    expect(
      Value.Check(realmSidebarWidgetSchema, {
        id: "notice",
        kind: "legacyNotice",
        pinboardKey: "home",
      }),
    ).toBe(false);
  });
});
