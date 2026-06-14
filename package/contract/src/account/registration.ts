import { t } from "elysia";
import { contentLanguageSchema } from "../language";
import { mediaUrlSchema } from "../media-url";
import { userDTOSchema } from "../user/user";

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
  displayName: t.Optional(t.String({ minLength: 1, maxLength: 80 })),
  slug: t.String({ minLength: 1 }),
  avatar: t.Optional(mediaUrlSchema),
  preferredLanguages: t.Optional(t.Array(contentLanguageSchema)),
});
export type AccountSetupBody = (typeof accountSetupBodySchema)["static"];

export const accountSetupErrorCodeSchema = t.Union([
  t.Literal("AUTH_SESSION_REQUIRED"),
  t.Literal("EMAIL_UNVERIFIED"),
  t.Literal("MAIN_USER_EXISTS"),
  t.Literal("MAIN_USER_NOT_FOUND"),
  t.Literal("PROFILE_SETUP_TOKEN_REQUIRED"),
  t.Literal("PROFILE_SETUP_TOKEN_INVALID"),
  t.Literal("PROFILE_SETUP_NOT_REQUIRED"),
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

export const accountMaterializationResponseSchema = t.Object({
  success: t.Boolean(),
  tokenState: t.Optional(profileSetupTokenStateSchema),
  error: t.Optional(accountSetupErrorSchema),
});
export type AccountMaterializationResponse =
  (typeof accountMaterializationResponseSchema)["static"];

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

export const mainEmailVerificationContractStatusSchema = t.Union([
  t.Literal("PENDING"),
  t.Literal("VERIFIED"),
  t.Literal("EXPIRED"),
]);

export const mainEmailVerificationContractStatusValues = [
  "PENDING",
  "VERIFIED",
  "EXPIRED",
] as const;

export type MainEmailVerificationContractStatus =
  (typeof mainEmailVerificationContractStatusSchema)["static"];

export const userEmailVerificationStateSchema = t.Object({
  email: t.Optional(t.String({ format: "email" })),
  verified: t.Boolean(),
  pendingEmail: t.Optional(t.String({ format: "email" })),
  contractStatus: t.Optional(mainEmailVerificationContractStatusSchema),
  expiresAt: t.Optional(t.Union([t.String(), t.Date()])),
  lastSentAt: t.Optional(t.Union([t.String(), t.Date()])),
});
export type UserEmailVerificationState =
  (typeof userEmailVerificationStateSchema)["static"];

export const userEmailVerificationRequestBodySchema = t.Object({
  email: t.String({ format: "email" }),
});
export type UserEmailVerificationRequestBody =
  (typeof userEmailVerificationRequestBodySchema)["static"];

export const userEmailVerificationConfirmBodySchema = t.Object({
  email: t.String({ format: "email" }),
  code: t.String({ minLength: 1 }),
});
export type UserEmailVerificationConfirmBody =
  (typeof userEmailVerificationConfirmBodySchema)["static"];

export const userEmailVerificationErrorCodeSchema = t.Union([
  t.Literal("EMAIL_ALREADY_VERIFIED"),
  t.Literal("DELIVERY_FAILED"),
  t.Literal("COOLDOWN"),
  t.Literal("INVALID_CODE"),
  t.Literal("EXPIRED_CODE"),
  t.Literal("CONTRACT_NOT_FOUND"),
]);
export type UserEmailVerificationErrorCode =
  (typeof userEmailVerificationErrorCodeSchema)["static"];

export const userEmailVerificationErrorSchema = t.Object({
  code: userEmailVerificationErrorCodeSchema,
  message: t.String(),
  retryAfterSeconds: t.Optional(t.Number()),
});
export type UserEmailVerificationError =
  (typeof userEmailVerificationErrorSchema)["static"];

export const userEmailVerificationResponseSchema = t.Object({
  success: t.Boolean(),
  state: t.Optional(userEmailVerificationStateSchema),
  error: t.Optional(userEmailVerificationErrorSchema),
});
export type UserEmailVerificationResponse =
  (typeof userEmailVerificationResponseSchema)["static"];
