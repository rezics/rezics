import { describe, expect, test } from "bun:test";
import { addSpecialSeedTarget, createSeedResult } from "./result";
import { UnitType } from "./storage-values";

describe("seed result", () => {
  test("stores special targets without a sync manifest", () => {
    const result = createSeedResult();

    addSpecialSeedTarget(result, {
      label: "Large fixture",
      scenario: "large-post-tree",
      unitType: UnitType.BOOK,
      unitId: "book-1",
    });

    expect(result).toEqual({
      specialTargets: [
        {
          label: "Large fixture",
          scenario: "large-post-tree",
          unitType: UnitType.BOOK,
          unitId: "book-1",
        },
      ],
    });
  });

  test("deduplicates special targets by scenario and Unit ID", () => {
    const result = createSeedResult();

    addSpecialSeedTarget(result, {
      label: "Complex shelf",
      scenario: "complex-shelf",
      unitType: UnitType.SHELF,
      unitId: "shelf-1",
    });
    addSpecialSeedTarget(result, {
      label: "Complex shelf again",
      scenario: "complex-shelf",
      unitType: UnitType.SHELF,
      unitId: "shelf-1",
      notes: "duplicate",
    });

    expect(result.specialTargets).toHaveLength(1);
    expect(result.specialTargets[0]?.label).toBe("Complex shelf");
    expect(result.specialTargets[0]?.notes).toBe("duplicate");
  });
});
