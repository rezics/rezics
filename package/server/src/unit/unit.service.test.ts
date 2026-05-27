import { describe, expect, test } from "bun:test";
import { buildUnitWhereClause } from "./unit.service";

describe("buildUnitWhereClause", () => {
  test("filters work-domain unit lists through UnitWork release membership", () => {
    expect(buildUnitWhereClause({ workUnitId: "work-1" })).toEqual({
      AND: [
        {
          workMemberships: {
            some: {
              workUnitId: "work-1",
              role: "RELEASE",
            },
          },
        },
      ],
    });
  });
});
