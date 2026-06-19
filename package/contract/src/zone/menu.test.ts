import { describe, expect, test } from "bun:test";
import { Value } from "@sinclair/typebox/value";
import { zoneMenuNodeSchema, zoneMenuSchema } from "./menu";

describe("zone menu contract", () => {
  test("accepts a recursive tree with unit, zonePage, and external targets", () => {
    expect(
      Value.Check(zoneMenuSchema, {
        slug: "main",
        nodes: [
          {
            labelUnitId: "label-1",
            children: [
              { target: { kind: "unit", unitId: "unit-1" } },
              {
                labelUnitId: "label-2",
                target: { kind: "zonePage", pageId: "search" },
              },
            ],
          },
          {
            target: {
              kind: "external",
              url: "https://example.com",
              text: "123456789",
            },
          },
        ],
      }),
    ).toBe(true);
  });

  test("a unit-targeted node needs no label config at all", () => {
    expect(
      Value.Check(zoneMenuNodeSchema, {
        target: { kind: "unit", unitId: "unit-1" },
      }),
    ).toBe(true);
  });

  test("rejects inline label text on nodes (zero-inline-text)", () => {
    expect(
      Value.Check(zoneMenuNodeSchema, {
        label: "Characters",
        target: { kind: "unit", unitId: "unit-1" },
      }),
    ).toBe(false);
    expect(
      Value.Check(zoneMenuNodeSchema, {
        title: { en: "Characters" },
        target: { kind: "unit", unitId: "unit-1" },
      }),
    ).toBe(false);
  });

  test("rejects unknown external-target shapes", () => {
    expect(
      Value.Check(zoneMenuNodeSchema, {
        target: {
          kind: "external",
          url: "https://example.com",
          text: { en: "translated map" },
        },
      }),
    ).toBe(false);
  });

  test("rejects legacy menu and node id fields", () => {
    expect(
      Value.Check(zoneMenuSchema, {
        id: "main",
        nodes: [],
      }),
    ).toBe(false);
    expect(
      Value.Check(zoneMenuNodeSchema, {
        id: "node-1",
        target: { kind: "unit", unitId: "unit-1" },
      }),
    ).toBe(false);
  });
});
