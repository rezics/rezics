import { t } from "elysia";
import { userDTOSchema } from "./user";

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
