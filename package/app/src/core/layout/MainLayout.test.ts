import { describe, expect, test } from "bun:test";
import { shouldShowVerificationBanner } from "./verificationBanner";

describe("shouldShowVerificationBanner", () => {
  test("shows the banner for auth-session users who still need verification", () => {
    expect(shouldShowVerificationBanner(true, true)).toBe(true);
  });

  test("hides the banner for anonymous or already-verified states", () => {
    expect(shouldShowVerificationBanner(false, true)).toBe(false);
    expect(shouldShowVerificationBanner(true, false)).toBe(false);
  });
});
