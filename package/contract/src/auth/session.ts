import { t } from "elysia";
import { permissionSchema } from "../permission";
import { authSessionStateSchema } from "./self-service";
import { authSessionSchema, authUserSchema } from "./sign-in";

export const AUTH_PRESENCE_COOKIE_NAME = "rezics_logged_in";
export const AUTH_PRESENCE_COOKIE_VALUE = "1";
export const AUTH_PRESENCE_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

export const getSessionResponseSchema = t.Object({
  session: authSessionSchema,
  user: authUserSchema,
});
export type GetSessionResponse = (typeof getSessionResponseSchema)["static"];

export const getSessionStateResponseSchema = t.Object({
  session: authSessionSchema,
  user: authUserSchema,
  authSession: authSessionStateSchema,
  rezicsUserId: t.Optional(t.Nullable(t.String())),
  rezicsPermission: t.Optional(t.Nullable(permissionSchema)),
});
export type GetSessionStateResponse =
  (typeof getSessionStateResponseSchema)["static"];

export const authTokenResponseSchema = t.Object({
  token: t.String(),
});
export type AuthTokenResponse = (typeof authTokenResponseSchema)["static"];

export const listSessionsResponseSchema = t.Array(authSessionSchema);
export type ListSessionsResponse =
  (typeof listSessionsResponseSchema)["static"];

export const revokeSessionBodySchema = t.Object({
  token: t.String(),
});
export type RevokeSessionBody = (typeof revokeSessionBodySchema)["static"];
