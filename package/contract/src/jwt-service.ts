import {t} from 'elysia';

export const jwtServiceDTOSchema = t.Object({
  id: t.String(),
  serviceKey: t.String(),
  issuer: t.String(),
  audience: t.String(),
  jwksUrl: t.String(),
  jwksPath: t.String(),
  isLocalIssuer: t.Boolean(),
  isActive: t.Boolean(),
  createdAt: t.String(),
  updatedAt: t.String(),
});

export type JwtServiceDTO = typeof jwtServiceDTOSchema.static;

export const createJwtServiceInputSchema = t.Object({
  serviceKey: t.String({minLength: 1}),
  issuer: t.String({minLength: 1}),
  audience: t.String({minLength: 1}),
  jwksUrl: t.String({minLength: 1}),
  jwksPath: t.String({minLength: 1}),
  isLocalIssuer: t.Optional(t.Boolean()),
});

export type CreateJwtServiceInput = typeof createJwtServiceInputSchema.static;

export const updateJwtServiceInputSchema = t.Object({
  issuer: t.Optional(t.String({minLength: 1})),
  audience: t.Optional(t.String({minLength: 1})),
  jwksUrl: t.Optional(t.String({minLength: 1})),
  jwksPath: t.Optional(t.String({minLength: 1})),
  isLocalIssuer: t.Optional(t.Boolean()),
});

export type UpdateJwtServiceInput = typeof updateJwtServiceInputSchema.static;

export const jwtServiceListResponseSchema = t.Object({
  services: t.Array(jwtServiceDTOSchema),
});

export type JwtServiceListResponse =
  typeof jwtServiceListResponseSchema.static;
