// User contracts

import {t} from 'elysia';

export const UserType = {
  USER: 'USER',
  AUTHOR: 'AUTHOR',
  PRESS: 'PRESS',
  PRODUCER: 'PRODUCER',
} as const;

export const UserTypeSchema = t.Union([
  t.Literal(UserType.USER),
  t.Literal(UserType.AUTHOR),
  t.Literal(UserType.PRESS),
  t.Literal(UserType.PRODUCER),
]);

export const userDTOSchema = t.Object({
  unitId: t.String(),
  email: t.Optional(t.String()),
  slug: t.Optional(t.String()),
  type: t.Optional(t.String()),
  name: t.String(),
  avatar: t.Optional(t.String()),
  bio: t.Optional(t.String()),
  description: t.Optional(t.String()),
  // Follow statistics
  followersCount: t.Optional(t.Number()),
  followingsCount: t.Optional(t.Number()),
  joinDate: t.Optional(t.String()),
  permission: t.Optional(
    t.Object(
      {
        role: t.Array(t.String()),
      },
      {additionalProperties: true},
    ),
  ),
});
export type UserDTO = (typeof userDTOSchema)['static'];

export const ensureUserResponseSchema = t.Object({
  user: userDTOSchema,
  alreadyCreated: t.Boolean(),
});
export type EnsureUserResponse =
  (typeof ensureUserResponseSchema)['static'];

export const sessionTokenResponseSchema = t.Object({
  token: t.String(),
});
export type SessionTokenResponse =
  (typeof sessionTokenResponseSchema)['static'];

export const userListQuerySchema = t.Object({
  q: t.Optional(t.String()),
  email: t.Optional(t.String()),
  slug: t.Optional(t.String()),
  type: t.Optional(t.String()),
  page: t.Optional(t.Numeric()),
  limit: t.Optional(t.Numeric()),
});

export type UserListQuery = (typeof userListQuerySchema)['static'];

export const userParamsSchema = t.Object({
  unitId: t.String(),
});

export type UserParams = (typeof userParamsSchema)['static'];

export const createUserSchema = t.Object({
  email: t.String({format: 'email'}),
  password: t.String({minLength: 6}),
  slug: t.String({
    minLength: 5,
    pattern: '^[a-zA-Z0-9](?:[a-zA-Z0-9-_]*[a-zA-Z0-9])?$',
  }),
  avatar: t.Optional(t.String()),
  bio: t.Optional(t.String()),
  verificationCode: t.Optional(t.String()),
});

export type CreateUser = (typeof createUserSchema)['static'];

export const createUserFullSchema = t.Object({
  ...createUserSchema.properties,
  type: t.Optional(UserTypeSchema),
});

export type CreateUserFull = (typeof createUserFullSchema)['static'];

export const updateUserSchema = t.Object({
  name: t.Optional(t.String({minLength: 1})),
  avatar: t.Optional(t.String()),
  bio: t.Optional(t.String()),
  description: t.Optional(t.String()),
  password: t.Optional(t.String({minLength: 6})),
});

export type UpdateUser = (typeof updateUserSchema)['static'];

export const loginSchema = t.Object({
  email: t.String({format: 'email'}),
  password: t.String(),
});

export type LoginUser = (typeof loginSchema)['static'];
