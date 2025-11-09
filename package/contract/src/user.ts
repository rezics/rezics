// User contracts
export type UserDTO = {
  unitId: string;
  email?: string;
  slug?: string;
  type?: string;
  name: string;
  avatar?: string;
  bio?: string;
  description?: string;
  joinDate?: string;
  permission?: any;
};

export type CreateUserInput = {
  email: string;
  password: string;
  slug: string;
  avatar?: string;
  bio?: string;
  description?: string;
};

export type UpdateUserInput = Partial<Omit<CreateUserInput, 'password'>> & {
  name?: string;
  password?: string;
};

import {t} from 'elysia';

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
});

export type CreateUser = (typeof createUserSchema)['static'];

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
