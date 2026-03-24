import {Elysia} from 'elysia';
import type {UpdateUser, UserDTO, UserListQuery} from '@package/contract';
import {
  userListQuerySchema,
  userParamsSchema,
  updateUserSchema,
} from '@package/contract';

import {userService} from '../service/user.service';
import {mapUserToDTO} from '../model/mapper';
import {requireAdmin} from '@/middleware';
import {BasicAdminPermission} from '@package/contract';

export const adminRoute = new Elysia()
  .use(requireAdmin)
  .get(
    '/admin',
    async ({
      query,
      session,
      currentUser,
      set,
    }): Promise<{users: UserDTO[]; total: number}> => {
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
    async ({params, session, currentUser, set}): Promise<UserDTO> => {
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
    async ({params, body, session, currentUser, set}): Promise<UserDTO> => {
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
    async ({params, session, currentUser, set}): Promise<{message: string}> => {
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
        summary: 'Admin delete user',
        description: 'Delete user as admin',
        tags: ['Users', 'Admin'],
      },
    },
  );
