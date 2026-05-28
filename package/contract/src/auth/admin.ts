import { t } from "elysia";

import { authUserSchema } from "./sign-in";

export const listUsersResponseSchema = t.Object({
  users: t.Array(authUserSchema),
  total: t.Number(),
});
export type ListUsersResponse = (typeof listUsersResponseSchema)["static"];

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
