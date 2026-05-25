import { ApiError } from "@rezics/api";
import { describe, expect, test } from "bun:test";
import {
  buildCurrentRedirectPath,
  isAdminRole,
  isUnauthorizedError,
  sanitizeRedirectPath,
} from "./adminAuthGuardUtils";

describe("adminAuthGuard", () => {
  test("allows owner and admin roles only", () => {
    expect(isAdminRole("owner")).toBe(true);
    expect(isAdminRole("admin")).toBe(true);
    expect(isAdminRole("user")).toBe(false);
    expect(isAdminRole(null)).toBe(false);
  });

  test("detects unauthorized API errors", () => {
    expect(isUnauthorizedError(new ApiError(401, "UNKNOWN", "Expired"))).toBe(
      true,
    );
    expect(isUnauthorizedError(new ApiError(403, "FORBIDDEN", "No"))).toBe(
      false,
    );
  });

  test("detects auth API errors encoded in Error messages", () => {
    expect(
      isUnauthorizedError(
        new Error(JSON.stringify({ status: 401, message: "Unauthorized" })),
      ),
    ).toBe(true);
    expect(isUnauthorizedError(new Error("Unauthorized"))).toBe(false);
  });

  test("keeps redirect targets local", () => {
    expect(sanitizeRedirectPath("/unit?id=1")).toBe("/unit?id=1");
    expect(sanitizeRedirectPath("//evil.example")).toBe("/");
    expect(sanitizeRedirectPath("https://evil.example")).toBe("/");
    expect(sanitizeRedirectPath(undefined)).toBe("/");
  });

  test("builds redirect paths from router locations", () => {
    expect(
      buildCurrentRedirectPath({
        pathname: "/unit/1",
        searchStr: "?tab=locks",
        hash: "#field",
      }),
    ).toBe("/unit/1?tab=locks#field");
  });
});
