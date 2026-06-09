import { describe, expect, test } from "bun:test";
import { Value } from "@sinclair/typebox/value";
import {
  type ZoneConfigV1,
  zoneBoundaryFilterSchema,
  zoneConfigV1Schema,
} from "./config-v1";

export const validZoneConfigV1: ZoneConfigV1 = {
  schema: "rezics/zone-config",
  version: 1,
  context: { kind: "realm", realmUnitId: "realm-toaru" },
  filters: {
    realm: "context",
    languages: "viewer",
  },
  menus: [
    {
      id: "main",
      nodes: [
        {
          id: "characters",
          labelUnitId: "label-characters",
          children: [
            { id: "kamijou", target: { kind: "unit", unitId: "entity-1" } },
          ],
        },
      ],
    },
  ],
  header: {
    menuId: "main",
    logoImageUnitId: "image-logo",
    searchPlaceholderKey: "zone.search.placeholder",
  },
  pages: {
    home: {
      sections: [
        { id: "s-hero", kind: "hero", showDescription: true },
        {
          id: "s-columns",
          kind: "columns",
          main: [
            { id: "s-notice", kind: "richText", contentUnitId: "fragment-1" },
            {
              id: "s-tabs",
              kind: "tabs",
              defaultTabId: "tab-latest",
              tabs: [
                {
                  id: "tab-latest",
                  titleLabelUnitId: "label-latest",
                  sections: [{ id: "s-feed", kind: "feed" }],
                },
                {
                  id: "tab-new",
                  sections: [
                    {
                      id: "s-new",
                      kind: "query",
                      display: "covers",
                      loadMore: true,
                      query: {
                        target: "unit",
                        types: ["BOOK"],
                        sort: { field: "publishedAt", direction: "desc" },
                      },
                    },
                  ],
                },
              ],
            },
          ],
          side: [
            {
              id: "s-stats",
              kind: "stats",
              metrics: ["articles", "members"],
            },
            {
              id: "s-links",
              kind: "collection",
              display: "list",
              items: [
                {
                  target: {
                    kind: "external",
                    url: "https://x.example",
                    text: "QQ 123",
                  },
                },
              ],
            },
          ],
        },
      ],
    },
  },
  theme: {
    tokens: { accent: "#1f6feb" },
    images: { logoUnitId: "image-logo" },
    layout: { contentWidth: "wide", density: "comfortable" },
  },
};

describe("zone config v1 envelope", () => {
  test("accepts a full config exercising every primitive", () => {
    expect(Value.Check(zoneConfigV1Schema, validZoneConfigV1)).toBe(true);
  });

  test("is strict at every level (additionalProperties: false)", () => {
    expect(
      Value.Check(zoneConfigV1Schema, {
        ...validZoneConfigV1,
        legacyTemplate: "wiki-classic",
      }),
    ).toBe(false);
    expect(
      Value.Check(zoneConfigV1Schema, {
        ...validZoneConfigV1,
        theme: { ...validZoneConfigV1.theme, navPosition: "side" },
      }),
    ).toBe(false);
    expect(
      Value.Check(zoneConfigV1Schema, {
        ...validZoneConfigV1,
        header: { ...validZoneConfigV1.header, title: "Toaru" },
      }),
    ).toBe(false);
  });

  test("requires the self-describing schema and version literals", () => {
    expect(
      Value.Check(zoneConfigV1Schema, {
        ...validZoneConfigV1,
        schema: "rezics.content",
      }),
    ).toBe(false);
    expect(
      Value.Check(zoneConfigV1Schema, { ...validZoneConfigV1, version: 2 }),
    ).toBe(false);
  });

  test("boundary filter is the query vocabulary minus sort and target", () => {
    expect("sort" in zoneBoundaryFilterSchema.properties).toBe(false);
    expect("target" in zoneBoundaryFilterSchema.properties).toBe(false);
    expect(
      Value.Check(zoneBoundaryFilterSchema, {
        types: ["POST"],
        postKinds: ["WIKI"],
        realm: { unitIds: ["realm-1"] },
        ratings: ["GENERAL"],
      }),
    ).toBe(true);
    expect(
      Value.Check(zoneBoundaryFilterSchema, {
        sort: { field: "createdAt" },
      }),
    ).toBe(false);
  });

  test("zero-inline-text: no schema node carries translation maps or inline titles", () => {
    // Walk the compiled JSON schema; the only string-bearing text property
    // allowed anywhere in the envelope is ZoneLinkTarget `external.text`.
    const forbiddenKeys = new Set(["title", "label", "translations", "name"]);
    const seenForbidden: string[] = [];
    const visit = (node: unknown, path: string) => {
      if (!node || typeof node !== "object") return;
      const record = node as Record<string, unknown>;
      const properties = record.properties as
        | Record<string, unknown>
        | undefined;
      if (properties) {
        for (const key of Object.keys(properties)) {
          if (forbiddenKeys.has(key)) seenForbidden.push(`${path}.${key}`);
          visit(properties[key], `${path}.${key}`);
        }
      }
      for (const childKey of ["items", "anyOf", "allOf", "oneOf"]) {
        const child = record[childKey];
        if (Array.isArray(child)) {
          for (const [index, sub] of child.entries()) {
            visit(sub, `${path}.${childKey}[${index}]`);
          }
        } else if (child) {
          visit(child, `${path}.${childKey}`);
        }
      }
      if (record.$defs) visit(record.$defs, `${path}.$defs`);
      if (
        record.$defs === undefined &&
        properties === undefined &&
        record.type === undefined
      ) {
        // $defs container objects (keyed by ref name)
        for (const [key, value] of Object.entries(record)) {
          if (typeof value === "object") visit(value, `${path}.${key}`);
        }
      }
    };
    visit(JSON.parse(JSON.stringify(zoneConfigV1Schema)), "config");
    expect(seenForbidden).toEqual([]);
  });
});
