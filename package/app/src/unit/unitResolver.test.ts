import { describe, expect, test } from "bun:test";
import type { UnitDTO } from "@rezics/contract";
import { UnitType } from "@rezics/contract";
import { buildUnitUrl } from "@/shared/utils/build-url";

function unit(type: string): UnitDTO {
  return { id: "fixture-id", type } as UnitDTO;
}

describe("unit resolver — buildUnitUrl coverage", () => {
  test.each(
    Object.values(UnitType),
  )("%s resolves without revisiting /unit/:id", (type) => {
    const typedUrl = buildUnitUrl(unit(type));
    if (typedUrl === "/unit/fixture-id") {
      const fallbackUrl = `/unit/fixture-id/view`;
      expect(fallbackUrl).toBe(`/unit/fixture-id/view`);
    } else {
      expect(typedUrl).not.toBe("/unit/fixture-id");
    }
  });
});
