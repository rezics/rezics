import { describe, expect, test } from "bun:test";
import { UnitStatus, UnitVisibility } from "#/prisma/client";
import {
  isPublicEligibleUnit,
  publicUnitEligibilityWhere,
} from "./publication-policy";

describe("publication policy", () => {
  test("public eligibility includes moderation approval", () => {
    expect(publicUnitEligibilityWhere).toEqual({
      status: UnitStatus.PUBLISHED,
      visibility: UnitVisibility.PUBLIC,
      moderationStatus: "APPROVED",
    });

    expect(
      isPublicEligibleUnit({
        status: UnitStatus.PUBLISHED,
        visibility: UnitVisibility.PUBLIC,
        moderationStatus: "APPROVED",
      } as never),
    ).toBe(true);
    expect(
      isPublicEligibleUnit({
        status: UnitStatus.PUBLISHED,
        visibility: UnitVisibility.PUBLIC,
        moderationStatus: "REMOVED",
      } as never),
    ).toBe(false);
  });
});
