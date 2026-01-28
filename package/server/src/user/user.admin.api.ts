import type {UpdateUser, UserDTO, UserListQuery} from '@package/contract';
import {
  userListQuerySchema,
  userParamsSchema,
  updateUserSchema,
  createUserSchema,
  type CreateUser,
} from '@package/contract';

import {t} from 'elysia';
import {coreInstance} from '../core';

import {userService} from './user.service';
import {mapUserToDTO} from './mapper';
import {validateSlug} from './slugVerify';
import {hashPassword, verifyAuth} from './utils';
import {BasicAdminPermission} from '@package/contract';

export const adminRoute = (api: ReturnType<typeof coreInstance>) => {
  return api
    .get(
      '/admin',
      async ({
        query,
        headers,
        jwt,
        set,
      }): Promise<{users: UserDTO[]; total: number}> => {
        const payload = await verifyAuth(headers.authorization, jwt, set);
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
          description: 'List users for admin (includes email)',
          tags: ['Users', 'Admin'],
        },
      },
    )
    .get(
      '/admin/:unitId',
      async ({params, headers, jwt, set}): Promise<UserDTO> => {
        const payload = await verifyAuth(headers.authorization, jwt, set);
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
          description: 'Get user detail for admin (includes email)',
          tags: ['Users', 'Admin'],
        },
      },
    )
    .post(
      '/admin',
      async ({body, headers, jwt, set}): Promise<UserDTO> => {
        const payload = await verifyAuth(headers.authorization, jwt, set);
        if (!BasicAdminPermission(payload as any)) {
          set.status = 403;
          throw new Error('Forbidden: Cannot create user');
        }

        const slugValidation = validateSlug(body.slug);
        if (!slugValidation.ok) {
          set.status = 400;
          throw new Error('Invalid slug: ' + slugValidation.reason);
        }

        const existingEmail = await userService.getByEmail(body.email);
        if (existingEmail) {
          set.status = 409;
          throw new Error('Email already exists');
        }
        const existingSlug = await userService.getBySlug(
          slugValidation.normalized,
        );
        if (existingSlug) {
          set.status = 409;
          throw new Error(
            `Slug(username: ${slugValidation.normalized}) already exists`,
          );
        }

        const passwordHash = await hashPassword(body.password);
        const user = await userService.create({
          email: body.email,
          password: passwordHash,
          slug: slugValidation.normalized,
          avatar: body.avatar,
          bio: body.bio,
        } as any);

        return mapUserToDTO(user);
      },
      {
        body: t.Intersect([
          createUserSchema,
          t.Object({
            verificationCode: t.Optional(t.String()), // ignored in admin create
          }),
        ]),
        detail: {
          summary: 'Admin create user',
          description: 'Create user as admin (no verification code required)',
          tags: ['Users', 'Admin'],
        },
      },
    )
    .put(
      '/admin/:unitId',
      async ({params, body, headers, jwt, set}): Promise<UserDTO> => {
        const payload = await verifyAuth(headers.authorization, jwt, set);
        if (!BasicAdminPermission(payload as any)) {
          set.status = 403;
          throw new Error('Forbidden: Cannot update user');
        }

        let passwordHash: string | undefined;
        if (body.password) {
          passwordHash = await hashPassword(body.password);
        }

        const userReq: UpdateUser = {
          name: body.name,
          avatar: body.avatar,
          bio: body.bio,
          description: body.description,
          password: passwordHash,
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
      async ({params, headers, jwt, set}): Promise<{message: string}> => {
        const payload = await verifyAuth(headers.authorization, jwt, set);
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
