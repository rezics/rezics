import { describe, expect, test } from "bun:test";
import { Value } from "@sinclair/typebox/value";
import { shelfDTOSchema } from "./shelf";

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
});
