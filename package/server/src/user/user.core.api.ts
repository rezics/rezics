import type {
  UpdateUser,
  UserDTO,
  UserListQuery,
} from '@package/contract';
import {userService} from './user.service';
import {mapUserToDTO, mapUserToPublicProfile} from './mapper';
import type {JWTPayload} from './types';
import {verifyAuth} from './utils';

import {
  userListQuerySchema,
  userParamsSchema,
  updateUserSchema,
} from '@package/contract';

import {
  hasPermissionToUpdateUser,
  BasicAdminPermission,
} from '@package/contract';

import {coreInstance} from '../core';
import {meiliService} from '@/src/meili/meili.service';
import {mapUserSearchDocToPublicProfile} from '@/src/meili/mapper';

export const coreRoute = (api: ReturnType<typeof coreInstance>) => {
  return (
    api
      /**
       * Get current user profile (requires JWT)
       * GET /users/me
       */
      .get(
        '/me',
        async ({headers, set}): Promise<UserDTO> => {
          const payload = await verifyAuth(headers.authorization, set);
          let user;
          try {
            user = await userService.getByUnitId(payload.unitId);
          } catch {
            user = await userService.provisionFromJwt({
              unitId: payload.unitId,
              slug: payload.slug,
            });
          }
          return mapUserToDTO(user);
        },
        {
          detail: {
            summary: 'Get current user',
            description: 'Get current authenticated user profile',
            tags: ['Users'],
          },
        },
      )

      /**
       * Get current user jwt payload
       */
      .get(
        '/me/jwt-payload',
        async ({headers, set}): Promise<JWTPayload> => {
          const payload = await verifyAuth<JWTPayload>(headers.authorization, set);
          return payload;
        },
        {
          detail: {
            summary: 'Get current user jwt payload',
            description: 'Get current authenticated user jwt payload',
            tags: ['Users'],
          },
        },
      )

      /**
       * Get all users with filters and pagination (public)
       * GET /users?q=search&page=1&limit=20
       */
      .get(
        '/',
        async ({
          query,
        }): Promise<{users: UserDTO[]; total: number}> => {
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
      )
      /**
       * Update current user (requires JWT)
       * PUT /users/me
       */
      .put(
        '/me',
        async ({headers, body, set}): Promise<UserDTO> => {
          const payload = await verifyAuth(headers.authorization, set);
          const userReq: UpdateUser = {
            name: body.name,
            avatar: body.avatar,
            bio: body.bio,
          };

          const user = await userService.update(payload.unitId, userReq);
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

      /**
       * Update user by unitId (requires JWT + admin permission)
       * PUT /users/:unitId
       * Note: For now, this only allows users to update their own profile
       */
      .put(
        '/:unitId',
        async ({headers, params, body, set}): Promise<UserDTO> => {
          const payload = await verifyAuth(headers.authorization, set);

          // Only allow users to update their own profile
          if (!hasPermissionToUpdateUser(payload as any, params.unitId)) {
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

      /**
       * Delete current user (requires JWT)
       * DELETE /users/me
       */
      .delete(
        '/me',
        async ({headers, set}): Promise<{message: string}> => {
          const payload = await verifyAuth(headers.authorization, set);
          // TODO Temporarily allow admin to delete any user
          if (!BasicAdminPermission(payload as any)) {
            set.status = 403;
            throw new Error('Forbidden: Cannot delete current user');
          }
          await userService.delete(payload.unitId);
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

      /**
       * Delete user by unitId (requires JWT + admin permission)
       * DELETE /users/:unitId
       * Note: For now, this only allows users to delete their own profile
       */
      .delete(
        '/:unitId',
        async ({headers, params, set}): Promise<{message: string}> => {
          const payload = await verifyAuth(headers.authorization, set);

          // TODO Temporarily allow admin to delete any user
          if (!BasicAdminPermission(payload as any)) {
            set.status = 403;
            throw new Error('Forbidden: Cannot delete other users');
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
      )
  );
};
