import { describe, expect, test } from "bun:test";
import { Value } from "@sinclair/typebox/value";
import {
  hasAmbiguousShelfListScopeFilters,
  shelfDTOSchema,
  shelfListBodySchema,
  shelfListQuerySchema,
} from "./shelf";

describe("shelf work-domain contract fields", () => {
  test("accepts matched contained release context", () => {
    expect(
      Value.Check(shelfDTOSchema, {
        unitId: "shelf-1",
        itemCount: 1,
        matchedUnit: {
          unitId: "release-2",
          kind: "book",
          title: "Translated Edition",
          workUnitId: "work-1",
        },
      }),
    ).toBe(true);
  });

  test("accepts exact and work-domain list filters separately", () => {
    expect(
      Value.Check(shelfListQuerySchema, {
        containsUnitId: "release-1",
        limit: 20,
      }),
    ).toBe(true);
    expect(
      Value.Check(shelfListBodySchema, {
        containsWorkUnitId: "work-1",
        limit: 20,
      }),
    ).toBe(true);
  });

  test("rejects ambiguous exact and work-domain list filters", () => {
    const query = {
      containsUnitId: "release-1",
      containsWorkUnitId: "work-1",
      limit: 20,
    };
    const body = {
      containsUnitId: "release-1",
      containsWorkUnitId: "work-1",
      limit: 20,
    };

    expect(Value.Check(shelfListQuerySchema, query)).toBe(true);
    expect(Value.Check(shelfListBodySchema, body)).toBe(true);
    expect(hasAmbiguousShelfListScopeFilters(query)).toBe(true);
    expect(hasAmbiguousShelfListScopeFilters(body)).toBe(true);
  });
});
