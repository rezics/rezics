import { describe, expect, test } from "bun:test";
import { Value } from "@sinclair/typebox/value";
import {
  authInternalVerifiedRegistrationFactsRequestSchema,
  authInternalVerifiedRegistrationFactsResponseSchema,
} from "./internal";

describe("auth internal contracts", () => {
  test("accepts verified registration facts boundary DTOs", () => {
    expect(
      Value.Check(authInternalVerifiedRegistrationFactsRequestSchema, {
        authUserId: "auth-user-1",
      }),
    ).toBe(true);

    expect(
      Value.Check(authInternalVerifiedRegistrationFactsResponseSchema, {
        success: true,
        facts: {
          authUserId: "auth-user-1",
          email: "reader@example.com",
          emailVerified: true,
          verifiedAt: "2026-05-07T00:00:00.000Z",
          verificationSource: "github",
          trustedProviderId: "github",
        },
      }),
    ).toBe(true);

    expect(
      Value.Check(authInternalVerifiedRegistrationFactsResponseSchema, {
        success: false,
        error: {
          code: "REGISTRATION_NOT_VERIFIED",
          message: "Registration verification is not complete",
        },
      }),
    ).toBe(true);
  });
});
