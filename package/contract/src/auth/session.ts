import {t} from 'elysia';

import {authSessionSchema, authUserSchema} from './sign-in';

export const getSessionResponseSchema = t.Object({
  session: authSessionSchema,
  user: authUserSchema,
});
export type GetSessionResponse = (typeof getSessionResponseSchema)['static'];

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
