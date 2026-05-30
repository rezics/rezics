import { describe, expect, test } from "bun:test";
import { Value } from "@sinclair/typebox/value";
import { rezicsSessionClaimsSchema } from "./token";

describe("rezics session token claims", () => {
  test("uses userId as the actor identity", () => {
    expect(
      Value.Check(rezicsSessionClaimsSchema, {
        tokenType: "member-session",
        sub: "user-1",
        userId: "user-1",
        role: "MEMBER",
        permission: { role: "MEMBER" },
        iss: "rezics-server",
        exp: 1_800_000_000,
        iat: 1_700_000_000,
      }),
    ).toBe(true);
  });

  test("does not define unitId as a session claim", () => {
    expect("unitId" in rezicsSessionClaimsSchema.properties).toBe(false);
  });
});
