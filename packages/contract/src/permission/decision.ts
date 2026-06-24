import { t } from "elysia";

export const decisionCodes = [
  "ALLOWED",
  "MISSING_CAPABILITY",
  "ENFORCEMENT_ACTIVE",
  "BLOCKED_ACCOUNT",
  "CROSS_REALM_DENIED",
  "LAST_OWNER_PROTECTED",
  "RATE_LIMITED",
  "NOT_MEMBER",
  "MISSING_RESOURCE",
  "OWNERSHIP_REQUIRED",
  "INSUFFICIENT_ROLE",
  "EXPIRED_GRANT",
  "INVALID_STATE",
] as const;

export type DecisionCode = (typeof decisionCodes)[number];

export const decisionCodeSchema = t.Union(
  decisionCodes.map((code) => t.Literal(code)) as [
    ReturnType<typeof t.Literal<DecisionCode>>,
    ReturnType<typeof t.Literal<DecisionCode>>,
    ...Array<ReturnType<typeof t.Literal<DecisionCode>>>,
  ],
);

export const decisionSchema = t.Object({
  allowed: t.Boolean(),
  code: decisionCodeSchema,
  reason: t.Optional(t.String()),
  safeMessage: t.Optional(t.String()),
  auditCode: t.Optional(t.String()),
  auditMetadata: t.Optional(t.Record(t.String(), t.Unknown())),
});

export type Decision = (typeof decisionSchema)["static"];

export const policyDecisionSchema = decisionSchema;
export type PolicyDecision = Decision;
