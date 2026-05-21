import { describe, expect, test } from "bun:test";
import { UnitType } from "../generated/client";
import { addSeedManifestEntry, createSeedResult } from "./manifest";

describe("seed manifest", () => {
  test("deduplicates entries and merges sync targets", () => {
    const result = createSeedResult();

    addSeedManifestEntry(result, {
      label: "Fixture",
      unitType: UnitType.BOOK,
      unitId: "unit-1",
      syncTargets: ["content"],
    });
    addSeedManifestEntry(result, {
      label: "Fixture",
      unitType: UnitType.BOOK,
      unitId: "unit-1",
      syncTargets: ["content", "content-contained-units"],
    });

    expect(result.manifest).toHaveLength(1);
    expect(result.manifest[0]?.syncTargets).toEqual([
      "content",
      "content-contained-units",
    ]);
  });
});
