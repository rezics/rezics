import { describe, expect, test } from "bun:test";
import { Value } from "@sinclair/typebox/value";
import {
  adminAuthUserAccountSummaryResponseSchema,
  adminAuthUserSessionsResponseSchema,
  adminStartAuthImpersonationResponseSchema,
  authEmailPreviewInputSchema,
  authEmailSendTestInputSchema,
  authEmailSmtpTestResponseSchema,
  authEmailTemplatesResponseSchema,
} from "./admin";

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

  test("accepts safe auth session metadata without raw tokens", () => {
    expect(
      Value.Check(adminAuthUserSessionsResponseSchema, {
        sessions: [
          {
            id: "session-1",
            authUserId: "auth-user-1",
            createdAt: "2026-05-28T00:00:00.000Z",
            updatedAt: "2026-05-28T00:00:00.000Z",
            expiresAt: "2026-06-28T00:00:00.000Z",
            ipAddress: "203.0.113.10",
            userAgent: "Mozilla/5.0",
            impersonatedBy: null,
          },
        ],
      }),
    ).toBe(true);
  });

  test("accepts audited impersonation start metadata", () => {
    expect(
      Value.Check(adminStartAuthImpersonationResponseSchema, {
        success: true,
        targetAuthUserId: "auth-user-1",
        startedAt: "2026-05-28T00:00:00.000Z",
        expiresAt: "2026-05-28T00:15:00.000Z",
        durationSeconds: 900,
        auditLogId: "audit-1",
      }),
    ).toBe(true);
  });

  test("accepts auth email admin contracts", () => {
    expect(
      Value.Check(authEmailTemplatesResponseSchema, [
        {
          name: "verification-code",
          description: "6-digit email verification code",
          propSchema: {
            code: {
              type: "string",
              required: true,
              description: "6-digit verification code",
            },
          },
        },
      ]),
    ).toBe(true);

    expect(
      Value.Check(authEmailPreviewInputSchema, {
        template: "verification-code",
        props: { code: "123456" },
      }),
    ).toBe(true);

    expect(
      Value.Check(authEmailSendTestInputSchema, {
        template: "verification-code",
        props: { code: "123456" },
        to: "admin@example.com",
      }),
    ).toBe(true);

    expect(
      Value.Check(authEmailSmtpTestResponseSchema, {
        connected: true,
        host: "smtp.example.com",
        port: "587",
      }),
    ).toBe(true);
  });
});
