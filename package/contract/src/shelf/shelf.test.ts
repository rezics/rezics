import { describe, expect, test } from "bun:test";
import { Value } from "@sinclair/typebox/value";
import {
  shelfDTOSchema,
  shelfListBodySchema,
  shelfListQuerySchema,
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
});
