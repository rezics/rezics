import { t } from "elysia";

export const authProviderIdSchema = t.Union([
  t.Literal("google"),
  t.Literal("microsoft"),
  t.Literal("github"),
  t.Literal("twitter"),
  t.Literal("telegram"),
]);
export type AuthProviderId = (typeof authProviderIdSchema)["static"];

export const authProviderSchema = t.Object({
  id: authProviderIdSchema,
  enabled: t.Boolean(),
});
export type AuthProvider = (typeof authProviderSchema)["static"];

export const authReadinessStatusSchema = t.Union([
  t.Literal("pending-verification"),
  t.Literal("needs-main-setup"),
  t.Literal("member-ready"),
]);
export type AuthReadinessStatus = (typeof authReadinessStatusSchema)["static"];

export const pendingRegistrationStepSchema = t.Union([
  t.Literal("verify-email"),
  t.Literal("setup-account"),
]);
export type PendingRegistrationStep =
  (typeof pendingRegistrationStepSchema)["static"];

export const pendingRegistrationStateSchema = t.Object({
  active: t.Boolean(),
  step: t.Optional(pendingRegistrationStepSchema),
  email: t.String({ format: "email" }),
  emailVerified: t.Boolean(),
  requiresEmailVerification: t.Boolean(),
  requiresMainAccountSetup: t.Boolean(),
});
export type PendingRegistrationState =
  (typeof pendingRegistrationStateSchema)["static"];

export const authAccountStateSchema = t.Object({
  email: t.String({ format: "email" }),
  emailVerified: t.Boolean(),
  mainUserExists: t.Boolean(),
  registrationComplete: t.Boolean(),
  canAcquireMemberToken: t.Boolean(),
  readinessStatus: authReadinessStatusSchema,
  pendingRegistration: pendingRegistrationStateSchema,
  hasPassword: t.Boolean(),
  canSetPassword: t.Boolean(),
  providerIds: t.Array(authProviderIdSchema),
  primaryProviderId: t.Optional(authProviderIdSchema),
  trustedProviderId: t.Optional(authProviderIdSchema),
});
export type AuthAccountState = (typeof authAccountStateSchema)["static"];

export const listAuthProvidersResponseSchema = t.Object({
  providers: t.Array(authProviderSchema),
});
export type ListAuthProvidersResponse =
  (typeof listAuthProvidersResponseSchema)["static"];

export const signInSocialBodySchema = t.Object({
  provider: authProviderIdSchema,
  callbackURL: t.Optional(t.String()),
  newUserCallbackURL: t.Optional(t.String()),
  errorCallbackURL: t.Optional(t.String()),
  disableRedirect: t.Optional(t.Boolean()),
});
export type SignInSocialBody = (typeof signInSocialBodySchema)["static"];

export const signInSocialResponseSchema = t.Object({
  url: t.String(),
  redirect: t.Boolean(),
});
export type SignInSocialResponse =
  (typeof signInSocialResponseSchema)["static"];

export const sendVerificationEmailBodySchema = t.Object({
  email: t.String({ format: "email" }),
  callbackURL: t.Optional(t.String()),
});
export type SendVerificationEmailBody =
  (typeof sendVerificationEmailBodySchema)["static"];

export const verificationErrorCodeSchema = t.Union([
  t.Literal("TURNSTILE_FAILED"),
  t.Literal("DELIVERY_FAILED"),
  t.Literal("COOLDOWN"),
  t.Literal("INVALID_OTP"),
  t.Literal("EXPIRED_OTP"),
  t.Literal("ALREADY_VERIFIED"),
  t.Literal("MISSING_EMAIL"),
  t.Literal("UNAUTHORIZED"),
]);
export type VerificationErrorCode =
  (typeof verificationErrorCodeSchema)["static"];

export const verificationErrorSchema = t.Object({
  code: verificationErrorCodeSchema,
  message: t.String(),
  retryAfterSeconds: t.Optional(t.Number()),
});
export type VerificationError = (typeof verificationErrorSchema)["static"];

export const sendVerificationEmailResponseSchema = t.Object({
  status: t.Boolean(),
  error: t.Optional(verificationErrorSchema),
  retryAfterSeconds: t.Optional(t.Number()),
});
export type SendVerificationEmailResponse =
  (typeof sendVerificationEmailResponseSchema)["static"];

export const sendVerificationOtpBodySchema = t.Object({
  email: t.String({ format: "email" }),
  type: t.Literal("email-verification"),
  turnstileToken: t.Optional(t.String()),
});
export type SendVerificationOtpBody =
  (typeof sendVerificationOtpBodySchema)["static"];

export const sendVerificationOtpResponseSchema = t.Object({
  success: t.Boolean(),
  error: t.Optional(verificationErrorSchema),
  retryAfterSeconds: t.Optional(t.Number()),
});
export type SendVerificationOtpResponse =
  (typeof sendVerificationOtpResponseSchema)["static"];

export const verifyEmailOtpBodySchema = t.Object({
  email: t.String({ format: "email" }),
  otp: t.String(),
});
export type VerifyEmailOtpBody = (typeof verifyEmailOtpBodySchema)["static"];

export const verifyEmailOtpResponseSchema = t.Object({
  status: t.Boolean(),
  token: t.Optional(t.Nullable(t.String())),
  user: t.Optional(
    t.Object({
      id: t.String(),
      email: t.String(),
      emailVerified: t.Boolean(),
      name: t.String(),
    }),
  ),
  error: t.Optional(verificationErrorSchema),
});
export type VerifyEmailOtpResponse =
  (typeof verifyEmailOtpResponseSchema)["static"];

export const verifyEmailQuerySchema = t.Object({
  token: t.String(),
  callbackURL: t.Optional(t.String()),
});
export type VerifyEmailQuery = (typeof verifyEmailQuerySchema)["static"];

export const verifyEmailResponseSchema = t.Object({
  status: t.Boolean(),
  user: t.Optional(
    t.Nullable(
      t.Object({
        id: t.String(),
        name: t.String(),
        role: t.String(),
        email: t.String(),
        emailVerified: t.Boolean(),
        image: t.Optional(t.Nullable(t.String())),
        createdAt: t.String(),
        updatedAt: t.String(),
      }),
    ),
  ),
});
export type VerifyEmailResponse = (typeof verifyEmailResponseSchema)["static"];

export const changeEmailBodySchema = t.Object({
  newEmail: t.String({ format: "email" }),
  callbackURL: t.Optional(t.String()),
});
export type ChangeEmailBody = (typeof changeEmailBodySchema)["static"];

export const changeEmailResponseSchema = t.Object({
  status: t.Boolean(),
  message: t.Optional(t.Nullable(t.String())),
});
export type ChangeEmailResponse = (typeof changeEmailResponseSchema)["static"];

export const setPasswordBodySchema = t.Object({
  newPassword: t.String(),
});
export type SetPasswordBody = (typeof setPasswordBodySchema)["static"];

export const setPasswordResponseSchema = t.Object({
  status: t.Boolean(),
});
export type SetPasswordResponse = (typeof setPasswordResponseSchema)["static"];
