import {Elysia, t} from 'elysia';
import {tokenService} from './token.service';
import {
  userParamsSchema,
  updateUserSchema,
  userListQuerySchema,
} from '@rezics/contract';
import {userService} from '@/user';
import {
  hasPermissionToReadUser,
  hasPermissionToUpdateUser,
  hasPermissionToCreateUser,
} from './permission';
import {meiliService} from '../meili/meili.service';
import {mapUserSearchDocToDTO} from '../meili/mapper';
import {mapUserToDTO} from '@/user';

const createUserProfileSchema = t.Object({
  unitId: t.Optional(t.String()),
  slug: t.String({
    minLength: 5,
    pattern: '^[a-zA-Z0-9](?:[a-zA-Z0-9-_]*[a-zA-Z0-9])?$',
  }),
  avatar: t.Optional(t.String()),
  bio: t.Optional(t.String()),
  type: t.Optional(
    t.Union([
      t.Literal('USER'),
      t.Literal('AUTHOR'),
      t.Literal('PRESS'),
      t.Literal('PRODUCER'),
    ]),
  ),
});

const tokenAuthHeaders = t.Object(
  {
    authorization: t.String(),
  },
  {
    additionalProperties: true,
  },
);

export const userRoute = new Elysia()
  /**
   * Token-authenticated: List users
   * GET /token/users
   */
  .get(
    '/users',
    async ({headers, set, query, request}) => {
      const ip =
        request.headers.get('x-forwarded-for') ??
        request.headers.get('x-real-ip') ??
        null;
      const userAgent = request.headers.get('user-agent') ?? null;

      const {scopes} = await tokenService.authenticateFromHeader(
        headers.authorization,
        {status: set.status as number | undefined},
        {ip, userAgent},
      );

      if (!hasPermissionToReadUser(scopes)) {
        set.status = 403;
        throw new Error('Forbidden: token does not have user:read scope');
      }

      const result = await meiliService.searchUsers(query);

      return {
        users: result.users.map(mapUserSearchDocToDTO),
        total: result.total,
      };
    },
    {
      query: userListQuerySchema,
      headers: tokenAuthHeaders,
      detail: {
        summary: 'List users (token)',
        description: 'List users with pagination and filtering',
        tags: ['Token', 'Users'],
      },
    },
  )

  /**
   * Token-authenticated: Create user
   * POST /token/users
   */
  .post(
    '/users',
    async ({headers, set, body, request}) => {
      const ip =
        request.headers.get('x-forwarded-for') ??
        request.headers.get('x-real-ip') ??
        null;
      const userAgent = request.headers.get('user-agent') ?? null;

      const {scopes} = await tokenService.authenticateFromHeader(
        headers.authorization,
        {status: set.status as number | undefined},
        {ip, userAgent},
      );

      if (!hasPermissionToCreateUser(scopes)) {
        set.status = 403;
        throw new Error('Forbidden: token does not have user:write scope');
      }

      const created = await userService.create(body);
      return mapUserToDTO(created);
    },
    {
      body: createUserProfileSchema,
      headers: tokenAuthHeaders,
      detail: {
        summary: 'Create user (token)',
        description: 'Create a new user using an API token',
        tags: ['Token', 'Users'],
      },
    },
  )

  /**
   * Token-authenticated: Get current user
   * GET /token/users/me
   */
  .get(
    '/users/me',
    async ({headers, set, request}) => {
      const ip =
        request.headers.get('x-forwarded-for') ??
        request.headers.get('x-real-ip') ??
        null;
      const userAgent = request.headers.get('user-agent') ?? null;

      const {userId, scopes} = await tokenService.authenticateFromHeader(
        headers.authorization,
        {status: set.status as number | undefined},
        {ip, userAgent},
      );

      if (!hasPermissionToReadUser(scopes)) {
        set.status = 403;
        throw new Error('Forbidden: token does not have user:read scope');
      }

      const user = await userService.getByUnitId(userId);
      return mapUserToDTO(user);
    },
    {
      headers: tokenAuthHeaders,
      detail: {
        summary: 'Get current user (token)',
        description: 'Get the user associated with the API token',
        tags: ['Token', 'Users'],
      },
    },
  )

  /**
   * Token-authenticated: Get user by unitId
   * GET /token/users/:unitId
   */
  .get(
    '/users/:unitId',
    async ({headers, set, params, request}) => {
      const ip =
        request.headers.get('x-forwarded-for') ??
        request.headers.get('x-real-ip') ??
        null;
      const userAgent = request.headers.get('user-agent') ?? null;

      const {scopes} = await tokenService.authenticateFromHeader(
        headers.authorization,
        {status: set.status as number | undefined},
        {ip, userAgent},
      );

      if (!hasPermissionToReadUser(scopes)) {
        set.status = 403;
        throw new Error('Forbidden: token does not have user:read scope');
      }

      const user = await userService.getByUnitId(params.unitId);
      return mapUserToDTO(user);
    },
    {
      params: userParamsSchema,
      headers: tokenAuthHeaders,
      detail: {
        summary: 'Get user (token)',
        description: 'Get a user by unit ID using an API token',
        tags: ['Token', 'Users'],
      },
    },
  )

  /**
   * Token-authenticated: Update user
   * PUT /token/users/:unitId
   */
  .put(
    '/users/:unitId',
    async ({headers, set, params, body, request}) => {
      const ip =
        request.headers.get('x-forwarded-for') ??
        request.headers.get('x-real-ip') ??
        null;
      const userAgent = request.headers.get('user-agent') ?? null;

      const {userId, scopes} = await tokenService.authenticateFromHeader(
        headers.authorization,
        {status: set.status as number | undefined},
        {ip, userAgent},
      );

      if (!hasPermissionToUpdateUser(scopes)) {
        set.status = 403;
        throw new Error('Forbidden: token does not have user:write scope');
      }

      const isAdmin = tokenService.hasAdminScope(scopes);
      if (!isAdmin && userId !== params.unitId) {
        set.status = 403;
        throw new Error('Forbidden: you can only update your own profile');
      }

      const updated = await userService.update(params.unitId, body);
      return mapUserToDTO(updated);
    },
    {
      params: userParamsSchema,
      body: updateUserSchema,
      headers: tokenAuthHeaders,
      detail: {
        summary: 'Update user (token)',
        description: 'Update a user by unit ID using an API token',
        tags: ['Token', 'Users'],
      },
    },
  );
