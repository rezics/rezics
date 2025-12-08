import {t} from 'elysia';
import {coreInstance} from '../core';
import {tokenService} from './token.service';
import {
  userParamsSchema,
  updateUserSchema,
  userListQuerySchema,
  createUserSchema,
  type UserDTO,
} from '@package/contract';
import {userService} from '../user/user.service';
import {
  hasPermissionToReadUser,
  hasPermissionToUpdateUser,
  hasPermissionToCreateUser,
} from './permission';

export const userRoute = (api: ReturnType<typeof coreInstance>) => {
  return (
    api
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

          const {users, total} = await userService.list(query);
          const {mapUserToDTO} = await import('../user/mapper');

          return {
            users: users.map(mapUserToDTO),
            total,
          };
        },
        {
          query: userListQuerySchema,
          headers: t.Object(
            {
              authorization: t.String(),
            },
            {
              additionalProperties: true,
            },
          ),
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
        async ({headers, set, body, request}): Promise<UserDTO> => {
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
          const {mapUserToDTO} = await import('../user/mapper');
          return mapUserToDTO(created);
        },
        {
          body: createUserSchema,
          headers: t.Object(
            {
              authorization: t.String(),
            },
            {
              additionalProperties: true,
            },
          ),
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
        async ({headers, set, request}): Promise<UserDTO> => {
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
          const {mapUserToDTO} = await import('../user/mapper');
          return mapUserToDTO(user);
        },
        {
          headers: t.Object(
            {
              authorization: t.String(),
            },
            {
              additionalProperties: true,
            },
          ),
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
        async ({headers, set, params, request}): Promise<UserDTO> => {
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
          const {mapUserToDTO} = await import('../user/mapper');
          return mapUserToDTO(user);
        },
        {
          params: userParamsSchema,
          headers: t.Object(
            {
              authorization: t.String(),
            },
            {
              additionalProperties: true,
            },
          ),
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
        async ({headers, set, params, body, request}): Promise<UserDTO> => {
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
          const {mapUserToDTO} = await import('../user/mapper');
          return mapUserToDTO(updated);
        },
        {
          params: userParamsSchema,
          body: updateUserSchema,
          headers: t.Object(
            {
              authorization: t.String(),
            },
            {
              additionalProperties: true,
            },
          ),
          detail: {
            summary: 'Update user (token)',
            description: 'Update a user by unit ID using an API token',
            tags: ['Token', 'Users'],
          },
        },
      )
  );
};
