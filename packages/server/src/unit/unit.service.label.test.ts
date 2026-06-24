import { describe, expect, test } from "bun:test";

const { buildUnitWhereClause } = await import("./unit.service");

describe("buildUnitWhereClause LABEL handling", () => {
  test("excludes LABEL Units from ordinary Unit lists", () => {
    expect(buildUnitWhereClause({})).toEqual({
      AND: [{ NOT: { type: "LABEL" } }],
    });
  });

  test("allows LABEL Units when explicitly requested", () => {
    expect(buildUnitWhereClause({ type: "LABEL" })).toEqual({
      AND: [{ type: { in: ["LABEL"] } }],
    });
  });
});
