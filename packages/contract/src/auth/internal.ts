import { t } from "elysia";
import { verifiedRegistrationFactsSchema } from "../account/registration";

export const authInternalVerifiedRegistrationFactsRequestSchema = t.Object({
  authUserId: t.String(),
});
export type AuthInternalVerifiedRegistrationFactsRequest =
  (typeof authInternalVerifiedRegistrationFactsRequestSchema)["static"];

export const authInternalVerifiedRegistrationFactsErrorSchema = t.Object({
  code: t.Union([
    t.Literal("AUTH_USER_NOT_FOUND"),
    t.Literal("REGISTRATION_NOT_VERIFIED"),
  ]),
  message: t.String(),
});
export type AuthInternalVerifiedRegistrationFactsError =
  (typeof authInternalVerifiedRegistrationFactsErrorSchema)["static"];

export const authInternalVerifiedRegistrationFactsResponseSchema = t.Union([
  t.Object({
    success: t.Literal(true),
    facts: verifiedRegistrationFactsSchema,
  }),
  t.Object({
    success: t.Literal(false),
    error: authInternalVerifiedRegistrationFactsErrorSchema,
  }),
]);
export type AuthInternalVerifiedRegistrationFactsResponse =
  (typeof authInternalVerifiedRegistrationFactsResponseSchema)["static"];

export const authInternalProjectSlugRequestSchema = t.Object({
  authUserId: t.String(),
  slug: t.String({ minLength: 1 }),
});
export type AuthInternalProjectSlugRequest =
  (typeof authInternalProjectSlugRequestSchema)["static"];

export const authInternalProjectSlugErrorSchema = t.Object({
  code: t.Literal("AUTH_USER_NOT_FOUND"),
  message: t.String(),
});
export type AuthInternalProjectSlugError =
  (typeof authInternalProjectSlugErrorSchema)["static"];

export const authInternalProjectSlugResponseSchema = t.Union([
  t.Object({
    success: t.Literal(true),
  }),
  t.Object({
    success: t.Literal(false),
    error: authInternalProjectSlugErrorSchema,
  }),
]);
export type AuthInternalProjectSlugResponse =
  (typeof authInternalProjectSlugResponseSchema)["static"];
