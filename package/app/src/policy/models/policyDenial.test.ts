import { ApiError } from "@rezics/api";
import { describe, expect, test } from "bun:test";
import { policyDenialFromError } from "./policyDenial";

describe("policyDenialFromError", () => {
  test("extracts a recognized decision code", () => {
    const denial = policyDenialFromError(
      new ApiError(403, "ENFORCEMENT_ACTIVE", "Restricted"),
    );
    expect(denial).toEqual({
      code: "ENFORCEMENT_ACTIVE",
      message: "Restricted",
    });
  });

  test("matches rate-limit denials", () => {
    const denial = policyDenialFromError(
      new ApiError(429, "RATE_LIMITED", "Slow down"),
    );
    expect(denial?.code).toBe("RATE_LIMITED");
  });

  test("ignores ALLOWED (not a denial)", () => {
    expect(
      policyDenialFromError(new ApiError(200, "ALLOWED", "ok")),
    ).toBeNull();
  });

  test("ignores unknown/non-decision codes", () => {
    expect(
      policyDenialFromError(new ApiError(500, "UNKNOWN", "boom")),
    ).toBeNull();
    expect(
      policyDenialFromError(new ApiError(404, "FIELD_LOCKED", "locked")),
    ).toBeNull();
  });

  test("ignores non-ApiError values", () => {
    expect(policyDenialFromError(new Error("plain"))).toBeNull();
    expect(policyDenialFromError(null)).toBeNull();
    expect(policyDenialFromError("RATE_LIMITED")).toBeNull();
  });

  test("omits message when the error has none", () => {
    const denial = policyDenialFromError(
      new ApiError(403, "BLOCKED_ACCOUNT", ""),
    );
    expect(denial).toEqual({ code: "BLOCKED_ACCOUNT" });
  });
});
