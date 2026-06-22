import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";

const src = readFileSync(
  join(import.meta.dir, "../../package/server/src/session/jwt/jwt.service.ts"),
  "utf-8",
);

describe("jwt.service type safety", () => {
  test("no as unknown as casts", () => {
    expect(src).not.toContain("as unknown as");
  });

  test("uses type predicate for session claims", () => {
    expect(src).toContain("is JWTPayload & RezicsSessionClaims");
  });

  test("uses type predicate for profile setup claims", () => {
    expect(src).toContain("is JWTPayload & RezicsProfileSetupClaims");
  });
});
