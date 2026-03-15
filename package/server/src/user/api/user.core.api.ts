import {Elysia} from 'elysia';
import type {
  AuthContextTokenClaims,
  AuthIdentityTokenClaims,
  EnsureUserResponse,
  UpdateUser,
  UserDTO,
  UserListQuery,
} from '@package/contract';
import {
  NormalizedTokenName,
  userListQuerySchema,
  userParamsSchema,
  ensureUserResponseSchema,
  updateUserSchema,
} from '@package/contract';
import {
  hasPermissionToUpdateUser,
  BasicAdminPermission,
  normalizedTokenTransportMap,
} from '@package/contract';
import {userService} from '../service/user.service';
import {mapUserToDTO} from '../model/mapper';
import {meiliService} from '@/src/meili/meili.service';
import {mapUserSearchDocToPublicProfile} from '@/src/meili/mapper';
import {
  identityContextPlugin,
  sessionContextPlugin,
} from '@/src/auth/context';
import {verifyAuthContextToken} from '../util';

const AUTH_CONTEXT_HEADER =
  normalizedTokenTransportMap[NormalizedTokenName.AUTH_CONTEXT].headerName;

export const coreRoute = new Elysia()
  .use(
    new Elysia()
      .use(sessionContextPlugin)
      .get(
        '/me',
        async ({currentUser}): Promise<UserDTO> => {
          const user = await userService.getByUnitId(currentUser.unitId);
          return mapUserToDTO(user);
        },
        {
          detail: {
            summary: 'Get current user',
            description:
              'Get current authenticated user profile without implicit provisioning.',
            tags: ['Users'],
          },
        },
      )
      .put(
        '/me',
        async ({identity, body}): Promise<UserDTO> => {
          const userReq: UpdateUser = {
            name: body.name,
            avatar: body.avatar,
            bio: body.bio,
          };

          const user = await userService.update(identity.unitId, userReq);
          return mapUserToDTO(user);
        },
        {
          body: updateUserSchema,
          detail: {
            summary: 'Update current user',
            description: 'Update current authenticated user profile',
            tags: ['Users'],
          },
        },
      )
      .put(
        '/:unitId',
        async ({identity, currentUser, params, body, set}): Promise<UserDTO> => {
          if (
            !hasPermissionToUpdateUser(
              {
                ...currentUser,
                unitId: identity.unitId,
              } as never,
              params.unitId,
            )
          ) {
            set.status = 403;
            throw new Error('Forbidden: Cannot update other users');
          }

          const userReq: UpdateUser = {
            name: body.name,
            avatar: body.avatar,
            bio: body.bio,
            description: body.description,
          };

          const user = await userService.update(params.unitId, userReq);
          return mapUserToDTO(user);
        },
        {
          params: userParamsSchema,
          body: updateUserSchema,
          detail: {
            summary: 'Update user',
            description: 'Update a user by unit ID (own profile only)',
            tags: ['Users'],
          },
        },
      )
      .delete(
        '/me',
        async ({identity, currentUser, set}): Promise<{message: string}> => {
          if (!BasicAdminPermission(currentUser)) {
            set.status = 403;
            throw new Error('Forbidden: Cannot delete current user');
          }
          await userService.delete(identity.unitId);
          return {message: 'User deleted successfully'};
        },
        {
          detail: {
            summary: 'Delete current user',
            description: 'Delete current authenticated user account',
            tags: ['Users'],
          },
        },
      )
      .delete(
        '/:unitId',
        async ({session, currentUser, params, set}): Promise<{message: string}> => {
          if (
            session.permission.role !== 'ROOT' &&
            session.permission.role !== 'ADMIN'
          ) {
            set.status = 403;
            throw new Error('Forbidden: Admin role required');
          }
          if (!BasicAdminPermission(currentUser)) {
            set.status = 403;
            throw new Error('Forbidden: Persisted admin permission required');
          }

          await userService.delete(params.unitId);
          return {message: 'User deleted successfully'};
        },
        {
          params: userParamsSchema,
          detail: {
            summary: 'Delete user',
            description: 'Delete a user by unit ID (own profile only)',
            tags: ['Users'],
          },
        },
      ),
  )
  .use(
    new Elysia()
      .use(identityContextPlugin)
      .get(
        '/ensure',
        async ({headers, identity, set}): Promise<EnsureUserResponse> => {
          const authorization = headers.authorization;
          if (!authorization) {
            set.status = 401;
            throw new Error('Unauthorized: Missing Authorization header');
          }

          const existingUser = await userService
            .getByUnitId(identity.unitId)
            .catch(() => null);

          if (existingUser) {
            return {
              user: mapUserToDTO(existingUser),
              alreadyCreated: true,
            };
          }

          const authContextHeader = headers[AUTH_CONTEXT_HEADER];
          if (!authContextHeader) {
            set.status = 401;
            throw new Error(`Unauthorized: Missing ${AUTH_CONTEXT_HEADER} header`);
          }

          const authContext = (
            await verifyAuthContextToken<AuthContextTokenClaims>(
              authContextHeader,
            )
          ).payload;
          const authContextUnitId =
            authContext.unitId ?? authContext.sub ?? authContext.id;

          if (authContextUnitId !== identity.unitId) {
            set.status = 401;
            throw new Error('Unauthorized: Auth context token mismatch');
          }

          const user = await userService.provisionFromAuthContext({
            unitId: identity.unitId,
            slug: authContext.slug,
            name: authContext.name,
            avatar: authContext.avatar,
          });

          return {
            user: mapUserToDTO(user),
            alreadyCreated: false,
          };
        },
        {
          response: ensureUserResponseSchema,
          detail: {
            summary: 'Ensure current user',
            description:
              'Verify auth identity, ensure the local business user exists, and return whether the user already existed.',
            tags: ['Users'],
          },
        },
      ),
  )
  .get(
    '/',
    async ({query}): Promise<{users: UserDTO[]; total: number}> => {
      const result = await meiliService.searchUsers(query as UserListQuery);
      return {
        users: result.users.map(mapUserSearchDocToPublicProfile),
        total: result.total,
      };
    },
    {
      query: userListQuerySchema,
      detail: {
        summary: 'Get all users',
        description: 'Get all users with filters and pagination',
        tags: ['Users'],
      },
    },
  );
