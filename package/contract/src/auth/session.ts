import {t} from 'elysia';

import {authSessionSchema, authUserSchema} from './sign-in';
import {authSessionStateSchema} from './self-service';

export const getSessionResponseSchema = t.Object({
  session: authSessionSchema,
  user: authUserSchema,
});
export type GetSessionResponse = (typeof getSessionResponseSchema)['static'];

export const getSessionStateResponseSchema = t.Object({
  session: authSessionSchema,
  user: authUserSchema,
  authSession: authSessionStateSchema,
});
export type GetSessionStateResponse =
  (typeof getSessionStateResponseSchema)['static'];

export const authTokenResponseSchema = t.Object({
  token: t.String(),
});
export type AuthTokenResponse = (typeof authTokenResponseSchema)['static'];

export const listSessionsResponseSchema = t.Array(authSessionSchema);
export type ListSessionsResponse = (typeof listSessionsResponseSchema)['static'];

export const revokeSessionBodySchema = t.Object({
  token: t.String(),
});
export type RevokeSessionBody = (typeof revokeSessionBodySchema)['static'];
