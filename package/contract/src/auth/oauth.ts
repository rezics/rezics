import {t} from 'elysia';

export const authorizeQuerySchema = t.Object({
  client_id: t.String(),
  redirect_uri: t.String(),
  response_type: t.String(),
  scope: t.Optional(t.String()),
  state: t.Optional(t.String()),
});
export type AuthorizeQuery = (typeof authorizeQuerySchema)['static'];

export const tokenRequestBodySchema = t.Object({
  grant_type: t.String(),
  code: t.Optional(t.String()),
  redirect_uri: t.Optional(t.String()),
  client_id: t.Optional(t.String()),
  client_secret: t.Optional(t.String()),
  refresh_token: t.Optional(t.String()),
});
export type TokenRequestBody = (typeof tokenRequestBodySchema)['static'];

export const tokenResponseSchema = t.Object({
  access_token: t.String(),
  token_type: t.String(),
  expires_in: t.Number(),
  refresh_token: t.Optional(t.String()),
  id_token: t.Optional(t.String()),
  scope: t.Optional(t.String()),
});
export type TokenResponse = (typeof tokenResponseSchema)['static'];

export const userinfoResponseSchema = t.Object({
  sub: t.String(),
  name: t.Optional(t.String()),
  email: t.Optional(t.String()),
  email_verified: t.Optional(t.Boolean()),
  picture: t.Optional(t.String()),
});
export type UserinfoResponse = (typeof userinfoResponseSchema)['static'];

export const clientRegistrationBodySchema = t.Object({
  client_name: t.String(),
  redirect_uris: t.Array(t.String()),
  grant_types: t.Optional(t.Array(t.String())),
  response_types: t.Optional(t.Array(t.String())),
  token_endpoint_auth_method: t.Optional(t.String()),
});
export type ClientRegistrationBody = (typeof clientRegistrationBodySchema)['static'];

export const clientRegistrationResponseSchema = t.Object({
  client_id: t.String(),
  client_secret: t.Optional(t.String()),
  client_name: t.String(),
  redirect_uris: t.Array(t.String()),
});
export type ClientRegistrationResponse = (typeof clientRegistrationResponseSchema)['static'];

export const revokeTokenBodySchema = t.Object({
  token: t.String(),
  token_type_hint: t.Optional(t.String()),
});
export type RevokeTokenBody = (typeof revokeTokenBodySchema)['static'];
