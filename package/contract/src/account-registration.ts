import { t } from "elysia";
import { userDTOSchema } from "./user";

export const accountStageSchema = t.Union([
  t.Literal("anonymous"),
  t.Literal("registration-verify"),
  t.Literal("profile-required"),
  t.Literal("member"),
]);
export type AccountStage = (typeof accountStageSchema)["static"];

export const verifiedRegistrationFactsSchema = t.Object({
  authUserId: t.String(),
  email: t.String({ format: "email" }),
  emailVerified: t.Literal(true),
  verifiedAt: t.Optional(t.Union([t.String(), t.Date()])),
  verificationSource: t.Optional(t.String()),
  trustedProviderId: t.Optional(t.String()),
});
export type VerifiedRegistrationFacts =
  (typeof verifiedRegistrationFactsSchema)["static"];

export const profileSetupTokenStateSchema = t.Object({
  active: t.Boolean(),
  stage: t.Literal("profile-required"),
  expiresAt: t.Optional(t.Union([t.String(), t.Date()])),
  userId: t.Optional(t.String()),
});
export type ProfileSetupTokenState =
  (typeof profileSetupTokenStateSchema)["static"];

export const profileSetupRenewalResponseSchema = t.Object({
  success: t.Boolean(),
  tokenState: t.Optional(profileSetupTokenStateSchema),
  error: t.Optional(
    t.Object({
      code: t.Union([
        t.Literal("AUTH_SESSION_REQUIRED"),
        t.Literal("PROFILE_SETUP_NOT_REQUIRED"),
        t.Literal("MAIN_USER_NOT_FOUND"),
        t.Literal("TOKEN_ISSUE_FAILED"),
      ]),
      message: t.String(),
    }),
  ),
});
export type ProfileSetupRenewalResponse =
  (typeof profileSetupRenewalResponseSchema)["static"];

export const profileSetupErrorCodeSchema = t.Union([
  t.Literal("AUTH_SESSION_REQUIRED"),
  t.Literal("PROFILE_SETUP_TOKEN_REQUIRED"),
  t.Literal("PROFILE_SETUP_TOKEN_EXPIRED"),
  t.Literal("PROFILE_SETUP_TOKEN_INVALID"),
  t.Literal("PROFILE_SETUP_NOT_REQUIRED"),
  t.Literal("SLUG_INVALID"),
  t.Literal("SLUG_TAKEN"),
  t.Literal("ACTIVATION_FAILED"),
]);
export type ProfileSetupErrorCode =
  (typeof profileSetupErrorCodeSchema)["static"];

export const profileSetupErrorSchema = t.Object({
  code: profileSetupErrorCodeSchema,
  message: t.String(),
});
export type ProfileSetupError = (typeof profileSetupErrorSchema)["static"];

export const accountSetupBodySchema = t.Object({
  displayName: t.String({ minLength: 1, maxLength: 80 }),
  slug: t.String({ minLength: 1 }),
});
export type AccountSetupBody = (typeof accountSetupBodySchema)["static"];

export const accountSetupErrorCodeSchema = t.Union([
  t.Literal("AUTH_SESSION_REQUIRED"),
  t.Literal("EMAIL_UNVERIFIED"),
  t.Literal("MAIN_USER_EXISTS"),
  t.Literal("SLUG_INVALID"),
  t.Literal("SLUG_TAKEN"),
]);
export type AccountSetupErrorCode =
  (typeof accountSetupErrorCodeSchema)["static"];

export const accountSetupErrorSchema = t.Object({
  code: accountSetupErrorCodeSchema,
  message: t.String(),
});
export type AccountSetupError = (typeof accountSetupErrorSchema)["static"];

export const accountSetupResponseSchema = t.Object({
  success: t.Boolean(),
  user: t.Optional(userDTOSchema),
  error: t.Optional(accountSetupErrorSchema),
});
export type AccountSetupResponse =
  (typeof accountSetupResponseSchema)["static"];

export const slugAvailabilityQuerySchema = t.Object({
  slug: t.String({ minLength: 1 }),
});
export type SlugAvailabilityQuery =
  (typeof slugAvailabilityQuerySchema)["static"];

export const slugAvailabilityResponseSchema = t.Object({
  available: t.Boolean(),
  normalized: t.Optional(t.String()),
  reason: t.Optional(t.String()),
});
export type SlugAvailabilityResponse =
  (typeof slugAvailabilityResponseSchema)["static"];
