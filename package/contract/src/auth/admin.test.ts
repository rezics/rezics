import { describe, expect, test } from "bun:test";
import { Value } from "@sinclair/typebox/value";
import { adminAuthUserAccountSummaryResponseSchema } from "./admin";

describe("auth admin contracts", () => {
  test("accepts main-server account summary enrichment", () => {
    expect(
      Value.Check(adminAuthUserAccountSummaryResponseSchema, {
        summaries: [
          {
            authUserId: "auth-user-1",
            mainUser: {
              unitId: "main-user-1",
              slug: "reader",
              name: "Reader",
              email: "reader@example.com",
              role: ["MEMBER"],
            },
            accountEnforcement: {
              activeCount: 1,
              activeKinds: ["BAN"],
              strongestKind: "BAN",
              expiresAt: null,
            },
            reconciliationWarnings: [],
          },
          {
            authUserId: "auth-user-2",
            accountEnforcement: {
              activeCount: 0,
              activeKinds: [],
            },
            reconciliationWarnings: [
              {
                code: "missing-main-profile",
                severity: "warning",
                message: "Auth user has no linked main-server profile.",
                suggestedAction:
                  "Materialize or reconcile the main user profile.",
              },
            ],
          },
        ],
      }),
    ).toBe(true);
  });
});
