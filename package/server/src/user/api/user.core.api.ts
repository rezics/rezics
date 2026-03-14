import {Elysia} from 'elysia';
import type {
  AuthIdentityTokenClaims,
  UpdateUser,
  UserDTO,
  UserListQuery,
} from '@package/contract';
import {
  userListQuerySchema,
  userParamsSchema,
  updateUserSchema,
} from '@package/contract';
import {
  hasPermissionToUpdateUser,
  BasicAdminPermission,
} from '@package/contract';
import {userService} from '../service/user.service';
import {mapUserToDTO} from '../model/mapper';
import {meiliService} from '@/src/meili/meili.service';
import {mapUserSearchDocToPublicProfile} from '@/src/meili/mapper';
import {
  assertMainServerEligibility,
  getAuthSessionState,
} from '@/src/auth/session-state';
import {
  identityContextPlugin,
  sessionContextPlugin,
} from '@/src/auth/context';
import {
  buildRezicsSessionClaims,
  REZICS_SESSION_HEADER,
} from '@/src/session/jwt';

function setRezicsSessionHeader(
  set: {headers?: unknown},
  token: string,
): void {
  const headers = (set.headers ?? {}) as Record<string, string>;
  set.headers = {
    ...headers,
    [REZICS_SESSION_HEADER]: token,
  };
}

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
        async ({headers, identity, jwt, set}): Promise<UserDTO> => {
          const authorization = headers.authorization;
          if (!authorization) {
            set.status = 401;
            throw new Error('Unauthorized: Missing Authorization header');
          }

          const sessionState = await getAuthSessionState(authorization);
          assertMainServerEligibility(sessionState);

          let user;
          try {
            user = await userService.getByUnitId(identity.unitId);
          } catch {
            user = await userService.provisionFromJwt({
              unitId: identity.unitId,
              slug: identity.slug,
            });
          }

          const sessionToken = await jwt.sign(
            buildRezicsSessionClaims({
              unitId: user.unitId,
              roles: (user.permission as {role?: string[]} | null)?.role,
            }),
          );
          setRezicsSessionHeader(set, sessionToken);

          return mapUserToDTO(user);
        },
        {
          detail: {
            summary: 'Ensure current user',
            description:
              'Verify auth identity, confirm auth-owned readiness, provision the business user if needed, and issue the main-server session token.',
            tags: ['Users'],
          },
        },
      )
      .get(
        '/session/refresh',
        async ({headers, identity, jwt, set}): Promise<{ok: true}> => {
          const authorization = headers.authorization;
          if (!authorization) {
            set.status = 401;
            throw new Error('Unauthorized: Missing Authorization header');
          }

          const sessionState = await getAuthSessionState(authorization);
          assertMainServerEligibility(sessionState);

          const user = await userService.getByUnitId(identity.unitId);
          const sessionToken = await jwt.sign(
            buildRezicsSessionClaims({
              unitId: user.unitId,
              roles: (user.permission as {role?: string[]} | null)?.role,
            }),
          );
          setRezicsSessionHeader(set, sessionToken);

          return {ok: true};
        },
        {
          detail: {
            summary: 'Refresh main-server session',
            description:
              'Reissue `rezics_session_token` from a still-valid auth identity after re-checking auth-owned session readiness.',
            tags: ['Users'],
          },
        },
      )
      .get(
        '/me/jwt-payload',
        async ({identity}): Promise<AuthIdentityTokenClaims> => {
          return identity;
        },
        {
          detail: {
            summary: 'Get current user jwt payload',
            description: 'Get current authenticated user jwt payload',
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
