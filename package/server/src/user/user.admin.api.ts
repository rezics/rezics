import type {UpdateUser, UserDTO, UserListQuery} from '@package/contract';
import {
  userListQuerySchema,
  userParamsSchema,
  updateUserSchema,
} from '@package/contract';

import {coreInstance} from '../core';

import {userService} from './user.service';
import {mapUserToDTO} from './mapper';
import {verifyAuth} from './utils';
import {BasicAdminPermission} from '@package/contract';

export const adminRoute = (api: ReturnType<typeof coreInstance>) => {
  return api
    .get(
      '/admin',
      async ({query, headers, set}): Promise<{users: UserDTO[]; total: number}> => {
        const payload = await verifyAuth(headers.authorization, set);
        if (!BasicAdminPermission(payload as any)) {
          set.status = 403;
          throw new Error('Forbidden: Cannot list users');
        }
        const {users, total} = await userService.list(query as any);
        return {users: users.map(mapUserToDTO), total};
      },
      {
        query: userListQuerySchema,
        detail: {
          summary: 'Admin list users',
          description: 'List users for admin',
          tags: ['Users', 'Admin'],
        },
      },
    )
    .get(
      '/admin/:unitId',
      async ({params, headers, set}): Promise<UserDTO> => {
        const payload = await verifyAuth(headers.authorization, set);
        if (!BasicAdminPermission(payload as any)) {
          set.status = 403;
          throw new Error('Forbidden: Cannot get user');
        }
        const user = await userService.getByUnitId(params.unitId);
        return mapUserToDTO(user);
      },
      {
        params: userParamsSchema,
        detail: {
          summary: 'Admin get user',
          description: 'Get user detail for admin',
          tags: ['Users', 'Admin'],
        },
      },
    )
    .put(
      '/admin/:unitId',
      async ({params, body, headers, set}): Promise<UserDTO> => {
        const payload = await verifyAuth(headers.authorization, set);
        if (!BasicAdminPermission(payload as any)) {
          set.status = 403;
          throw new Error('Forbidden: Cannot update user');
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
          summary: 'Admin update user',
          description: 'Update user as admin',
          tags: ['Users', 'Admin'],
        },
      },
    )
    .delete(
      '/admin/:unitId',
      async ({params, headers, set}): Promise<{message: string}> => {
        const payload = await verifyAuth(headers.authorization, set);
        if (!BasicAdminPermission(payload as any)) {
          set.status = 403;
          throw new Error('Forbidden: Cannot delete user');
        }
        await userService.delete(params.unitId);
        return {message: 'User deleted successfully'};
      },
      {
        params: userParamsSchema,
        detail: {
          summary: 'Admin delete user',
          description: 'Delete user as admin',
          tags: ['Users', 'Admin'],
        },
      },
    );
};
