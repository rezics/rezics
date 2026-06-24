import { describe, expect, test } from "bun:test";
import { Value } from "@sinclair/typebox/value";
import { zoneMenuNodeSchema, zoneMenuSchema } from "./menu";

describe("zone menu contract", () => {
  test("accepts a recursive tree with unit, zonePage, and external targets", () => {
    expect(
      Value.Check(zoneMenuSchema, {
        id: "main",
        nodes: [
          {
            id: "characters",
            labelUnitId: "label-1",
            children: [
              { id: "kamijou", target: { kind: "unit", unitId: "unit-1" } },
              {
                id: "search",
                labelUnitId: "label-2",
                target: { kind: "zonePage", pageId: "search" },
              },
            ],
          },
          {
            id: "qq",
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
        id: "n1",
        target: { kind: "unit", unitId: "unit-1" },
      }),
    ).toBe(true);
  });

  test("rejects inline label text on nodes (zero-inline-text)", () => {
    expect(
      Value.Check(zoneMenuNodeSchema, {
        id: "n1",
        label: "Characters",
        target: { kind: "unit", unitId: "unit-1" },
      }),
    ).toBe(false);
    expect(
      Value.Check(zoneMenuNodeSchema, {
        id: "n1",
        title: { en: "Characters" },
        target: { kind: "unit", unitId: "unit-1" },
      }),
    ).toBe(false);
  });

  test("rejects unknown external-target shapes", () => {
    expect(
      Value.Check(zoneMenuNodeSchema, {
        id: "n1",
        target: {
          kind: "external",
          url: "https://example.com",
          text: { en: "translated map" },
        },
      }),
    ).toBe(false);
  });
});
