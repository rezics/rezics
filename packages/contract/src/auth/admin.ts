import { t } from "elysia";

export const adminAuthUserSchema = t.Object({
  id: t.String(),
  name: t.String(),
  email: t.String(),
  role: t.String(),
  banned: t.Boolean(),
  emailVerified: t.Optional(t.Boolean()),
  sessions: t.Optional(t.Array(t.Unknown())),
  sessionCount: t.Optional(t.Number()),
  createdAt: t.Union([t.String(), t.Date()]),
  updatedAt: t.Optional(t.Union([t.String(), t.Date()])),
  image: t.Optional(t.Nullable(t.String())),
  banReason: t.Optional(t.Nullable(t.String())),
  banExpires: t.Optional(t.Nullable(t.Union([t.String(), t.Date()]))),
});
export type AdminAuthUser = (typeof adminAuthUserSchema)["static"];

export const listUsersResponseSchema = t.Object({
  users: t.Array(adminAuthUserSchema),
  total: t.Optional(t.Number()),
});
export type AdminAuthUsersResponse =
  (typeof listUsersResponseSchema)["static"];
export type ListUsersResponse = AdminAuthUsersResponse;

export const removeUserBodySchema = t.Object({
  userId: t.String(),
});
export type RemoveUserBody = (typeof removeUserBodySchema)["static"];

export const banUserBodySchema = t.Object({
  userId: t.String(),
  reason: t.Optional(t.String()),
});
export type BanUserBody = (typeof banUserBodySchema)["static"];

export const unbanUserBodySchema = t.Object({
  userId: t.String(),
});
export type UnbanUserBody = (typeof unbanUserBodySchema)["static"];

export const setRoleBodySchema = t.Object({
  userId: t.String(),
  role: t.String(),
});
export type SetRoleBody = (typeof setRoleBodySchema)["static"];

export const authMainServerReconciliationWarningSchema = t.Object({
  code: t.Union([
    t.Literal("missing-main-profile"),
    t.Literal("missing-auth-link"),
    t.Literal("email-drift"),
  ]),
  severity: t.Union([
    t.Literal("info"),
    t.Literal("warning"),
    t.Literal("error"),
  ]),
  message: t.String(),
  suggestedAction: t.Optional(t.String()),
});
export type AuthMainServerReconciliationWarning =
  (typeof authMainServerReconciliationWarningSchema)["static"];

export const adminAuthUserAccountSummaryRequestSchema = t.Object({
  authUserIds: t.Array(t.String()),
});
export type AdminAuthUserAccountSummaryRequest =
  (typeof adminAuthUserAccountSummaryRequestSchema)["static"];

export const adminAuthUserAccountSummarySchema = t.Object({
  authUserId: t.String(),
  mainUser: t.Optional(
    t.Object({
      unitId: t.String(),
      slug: t.Optional(t.String()),
      name: t.Optional(t.String()),
      email: t.Optional(t.String()),
      role: t.Optional(t.Array(t.String())),
    }),
  ),
  accountEnforcement: t.Object({
    activeCount: t.Number(),
    activeKinds: t.Array(t.String()),
    strongestKind: t.Optional(t.String()),
    expiresAt: t.Optional(t.Nullable(t.String())),
  }),
  reconciliationWarnings: t.Array(authMainServerReconciliationWarningSchema),
});
export type AdminAuthUserAccountSummary =
  (typeof adminAuthUserAccountSummarySchema)["static"];

export const adminAuthUserAccountSummaryResponseSchema = t.Object({
  summaries: t.Array(adminAuthUserAccountSummarySchema),
});
export type AdminAuthUserAccountSummaryResponse =
  (typeof adminAuthUserAccountSummaryResponseSchema)["static"];

export const adminAuthSessionSchema = t.Object({
  id: t.String(),
  authUserId: t.String(),
  createdAt: t.String(),
  updatedAt: t.String(),
  expiresAt: t.String(),
  ipAddress: t.Optional(t.Nullable(t.String())),
  userAgent: t.Optional(t.Nullable(t.String())),
  impersonatedBy: t.Optional(t.Nullable(t.String())),
});
export type AdminAuthSession = (typeof adminAuthSessionSchema)["static"];

export const adminAuthUserSessionsRequestSchema = t.Object({
  authUserId: t.String({ minLength: 1 }),
});
export type AdminAuthUserSessionsRequest =
  (typeof adminAuthUserSessionsRequestSchema)["static"];

export const adminAuthUserSessionsResponseSchema = t.Object({
  sessions: t.Array(adminAuthSessionSchema),
});
export type AdminAuthUserSessionsResponse =
  (typeof adminAuthUserSessionsResponseSchema)["static"];

export const adminRevokeAuthSessionRequestSchema = t.Object({
  authUserId: t.String({ minLength: 1 }),
  sessionId: t.String({ minLength: 1 }),
  reason: t.String({ minLength: 1 }),
});
export type AdminRevokeAuthSessionRequest =
  (typeof adminRevokeAuthSessionRequestSchema)["static"];

export const adminRevokeAuthUserSessionsRequestSchema = t.Object({
  authUserId: t.String({ minLength: 1 }),
  reason: t.String({ minLength: 1 }),
});
export type AdminRevokeAuthUserSessionsRequest =
  (typeof adminRevokeAuthUserSessionsRequestSchema)["static"];

export const adminAuthSessionMutationResponseSchema = t.Object({
  success: t.Boolean(),
  revokedSessions: t.Number(),
  auditLogId: t.Optional(t.String()),
});
export type AdminAuthSessionMutationResponse =
  (typeof adminAuthSessionMutationResponseSchema)["static"];

export const adminStartAuthImpersonationRequestSchema = t.Object({
  targetAuthUserId: t.String({ minLength: 1 }),
  reason: t.String({ minLength: 1 }),
  durationSeconds: t.Optional(t.Number({ minimum: 60, maximum: 3600 })),
});
export type AdminStartAuthImpersonationRequest =
  (typeof adminStartAuthImpersonationRequestSchema)["static"];

export const adminStartAuthImpersonationResponseSchema = t.Object({
  success: t.Boolean(),
  targetAuthUserId: t.String(),
  startedAt: t.String(),
  expiresAt: t.String(),
  durationSeconds: t.Number(),
  auditLogId: t.String(),
});
export type AdminStartAuthImpersonationResponse =
  (typeof adminStartAuthImpersonationResponseSchema)["static"];

export const authEmailTemplatePropSchema = t.Object({
  type: t.String(),
  required: t.Boolean(),
  description: t.String(),
});
export type AuthEmailTemplateProp =
  (typeof authEmailTemplatePropSchema)["static"];

export const authEmailTemplateSchema = t.Object({
  name: t.String(),
  description: t.String(),
  propSchema: t.Record(t.String(), authEmailTemplatePropSchema),
});
export type AuthEmailTemplate = (typeof authEmailTemplateSchema)["static"];

export const authEmailTemplatesResponseSchema = t.Array(
  authEmailTemplateSchema,
);
export type AuthEmailTemplatesResponse =
  (typeof authEmailTemplatesResponseSchema)["static"];

export const authEmailRenderPropsSchema = t.Record(t.String(), t.Unknown());
export type AuthEmailRenderProps =
  (typeof authEmailRenderPropsSchema)["static"];

export const authEmailPreviewInputSchema = t.Object({
  template: t.String(),
  props: authEmailRenderPropsSchema,
});
export type AuthEmailPreviewInput =
  (typeof authEmailPreviewInputSchema)["static"];

export const authEmailSendTestInputSchema = t.Intersect([
  authEmailPreviewInputSchema,
  t.Object({
    to: t.String(),
  }),
]);
export type AuthEmailSendTestInput =
  (typeof authEmailSendTestInputSchema)["static"];

export const authEmailPreviewResponseSchema = t.Object({
  html: t.String(),
});
export type AuthEmailPreviewResponse =
  (typeof authEmailPreviewResponseSchema)["static"];

export const authEmailSendTestResponseSchema = t.Object({
  success: t.Boolean(),
  to: t.String(),
});
export type AuthEmailSendTestResponse =
  (typeof authEmailSendTestResponseSchema)["static"];

export const authEmailSmtpTestResponseSchema = t.Object({
  connected: t.Boolean(),
  host: t.Optional(t.String()),
  port: t.Optional(t.String()),
  error: t.Optional(t.String()),
});
export type AuthEmailSmtpTestResponse =
  (typeof authEmailSmtpTestResponseSchema)["static"];

export const authEmailErrorResponseSchema = t.Object({
  error: t.String(),
});
export type AuthEmailErrorResponse =
  (typeof authEmailErrorResponseSchema)["static"];
