import { describe, expect, test } from "bun:test";
import {
  isPublicEligibleUnit,
  publicUnitEligibilityWhere,
} from "./publication-policy";

describe("publication policy", () => {
  test("public eligibility includes moderation approval", () => {
    expect(publicUnitEligibilityWhere).toEqual({
      status: "PUBLISHED",
      visibility: "PUBLIC",
      moderationStatus: "APPROVED",
    });

    expect(
      isPublicEligibleUnit({
        status: "PUBLISHED",
        visibility: "PUBLIC",
        moderationStatus: "APPROVED",
      }),
    ).toBe(true);
    expect(
      isPublicEligibleUnit({
        status: "PUBLISHED",
        visibility: "PUBLIC",
        moderationStatus: "REMOVED",
      }),
    ).toBe(false);
  });
});
