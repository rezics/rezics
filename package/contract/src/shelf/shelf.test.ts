import { describe, expect, test } from "bun:test";
import { Value } from "@sinclair/typebox/value";
import {
  addShelfUnitSchema,
  collectInputSchema,
  shelfDTOSchema,
  shelfListBodySchema,
  shelfListQuerySchema,
  shelfUnitDTOSchema,
  shelfUnitsQuerySchema,
} from "./shelf";

describe("shelf containment contract fields", () => {
  test("accepts matched contained unit context", () => {
    expect(
      Value.Check(shelfDTOSchema, {
        unitId: "shelf-1",
        itemCount: 1,
        matchedUnit: {
          unitId: "release-2",
          kind: "book",
          title: "Translated Edition",
        },
      }),
    ).toBe(true);
  });

  test("accepts exact list filters", () => {
    expect(
      Value.Check(shelfListQuerySchema, {
        containsUnitId: "release-1",
        limit: 20,
      }),
    ).toBe(true);
    expect(
      Value.Check(shelfListBodySchema, {
        containsUnitId: "release-1",
        limit: 20,
      }),
    ).toBe(true);
  });

  test("accepts weak variant context separately from containment", () => {
    expect(
      Value.Check(addShelfUnitSchema, {
        unitId: "main-1",
        variantUnitId: "variant-1",
        kind: "book",
      }),
    ).toBe(true);
    expect(
      Value.Check(shelfUnitDTOSchema, {
        shelfId: "shelf-1",
        unitId: "main-1",
        variantUnitId: "variant-1",
        variantContext: {
          unitId: "variant-1",
          title: "Selected Edition",
        },
        kind: "book",
        position: "a0",
      }),
    ).toBe(true);
    expect(
      Value.Check(shelfListQuerySchema, {
        containsUnitId: "main-1",
        variantUnitId: "variant-1",
        limit: 20,
      }),
    ).toBe(true);
    expect(
      Value.Check(shelfListBodySchema, {
        containsUnitId: "main-1",
        variantUnitId: "variant-1",
        limit: 20,
      }),
    ).toBe(true);
    expect(
      Value.Check(shelfUnitsQuerySchema, {
        variantUnitId: "variant-1",
        limit: 20,
      }),
    ).toBe(true);
    expect(
      Value.Check(collectInputSchema, {
        targetId: "main-1",
        variantUnitId: "variant-1",
        shelfIds: ["shelf-1"],
      }),
    ).toBe(true);
  });
});
