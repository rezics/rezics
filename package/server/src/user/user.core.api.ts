import type {
  CreateUser,
  UpdateUser,
  UserDTO,
  UserListQuery,
} from '@package/contract';
import {userService} from './user.service';
import {mapUserToDTO, mapUserToPublicProfile} from './mapper';
import type {JWTPayload, RefreshTokenPayload} from './types';
import {sessionService} from './user.session.service';
import {validateSlug} from './slugVerify';

import {v7 as uuidv7} from 'uuid';

import {hashPassword, verifyAuth} from './utils';

import {
  userListQuerySchema,
  userParamsSchema,
  createUserSchema,
  updateUserSchema,
  loginSchema,
} from '@package/contract';

import {
  hasPermissionToUpdateUser,
  BasicAdminPermission,
} from '@package/contract';

import {t} from 'elysia';
import {coreInstance} from '../core';
import {setCookie} from '../utils/cookie';
import {meiliService} from '@/src/meili/meili.service';
import {mapUserSearchDocToPublicProfile} from '@/src/meili/mapper';

export const coreRoute = (api: ReturnType<typeof coreInstance>) => {
  return (
    api
      /**
       * Register new user (public)
       * POST /users/register
       */
      .post(
        '/register',
        async ({
          body,
          jwt,
          refreshToken,
          cookie: {refresh_token},
          set,
        }): Promise<{user: UserDTO; token: string}> => {
          const verificationCode = body.verificationCode;
          if (verificationCode) {
            const result = await userService.verifyVerificationCode(
              body.email,
              verificationCode,
            );
            console.log('verifyVerificationCode result', result);
            if (result.status === 'error') {
              set.status = 400;
              throw new Error('Invalid verification code');
            }
          } else {
            set.status = 400;
            throw new Error('Verification code is required');
          }

          // Check if slug is valid
          const slugValidation = validateSlug(body.slug);
          if (!slugValidation.ok) {
            set.status = 400;
            throw new Error('Invalid slug: ' + slugValidation.reason);
          }

          // Check if email already exists
          let existing = await userService.getByEmail(body.email);
          if (existing) {
            throw new Error('Email already exists');
          }

          existing = await userService.getBySlug(body.slug);
          if (existing) {
            throw new Error(`Slug(username: ${body.slug}) already exists`);
          }

          const passwordHash = await hashPassword(body.password);
          const userReq: CreateUser = {
            email: body.email,
            password: passwordHash,
            slug: slugValidation.normalized,
            avatar: body.avatar,
            bio: body.bio,
          };

          const user = await userService.create(userReq);

          // Generate JWT token
          const token = await jwt.sign({
            unitId: user.unitId,
            email: user.email,
            slug: user.slug,
            permission: JSON.parse(JSON.stringify({roles: ['USER']})),
          } as JWTPayload);

          const sessionId = uuidv7();
          const refreshTokenSign = await refreshToken.sign({
            sessionId: sessionId,
            unitId: user.unitId,
            type: 'refreshToken',
          } as RefreshTokenPayload);

          // 为新注册用户创建基于数据库的 refresh 会话记录
          await sessionService.createSession({
            sessionId: sessionId,
            userId: user.unitId,
            refreshToken: refreshTokenSign,
          });

          setCookie(refresh_token!, {
            value: refreshTokenSign,
            httpOnly: true,
            secure: true,
            sameSite: 'lax',
            path: '/users/refresh-token',
            maxAge: 60 * 60 * 24 * 30,
          });

          return {user: mapUserToDTO(user), token};
        },
        {
          body: createUserSchema,
          detail: {
            summary: 'Register user',
            description: 'Register a new user account',
            tags: ['Users'],
          },
        },
      )

      /**
       * Login user (public)
       * POST /users/login
       */
      .post(
        '/login',
        async ({
          body,
          jwt,
          refreshToken,
          cookie: {refresh_token},
        }): Promise<{user: UserDTO; token: string}> => {
          const user = await userService.authenticate(
            body.email,
            body.password,
          );

          if (!user) {
            throw new Error(`Invalid email or password: ${body.email}`);
          }

          // Generate JWT token
          const token = await jwt.sign({
            unitId: user.unitId,
            email: user.email,
            slug: user.slug,
            permission: user.permission,
          } as JWTPayload);

          const sessionId = uuidv7();
          const refreshTokenSign = await refreshToken.sign({
            sessionId: sessionId,
            unitId: user.unitId,
            type: 'refreshToken',
          } as RefreshTokenPayload);

          // 登录成功后，为用户创建 / 追加新的 refresh 会话记录
          await sessionService.createSession({
            sessionId: sessionId,
            userId: user.unitId,
            refreshToken: refreshTokenSign,
          });

          setCookie(refresh_token!, {
            value: refreshTokenSign,
            httpOnly: true,
            secure: true,
            sameSite: 'lax',
            path: '/users/refresh-token',
            maxAge: 60 * 60 * 24 * 30,
          });

          return {user: mapUserToDTO(user), token};
        },
        {
          body: loginSchema,
          detail: {
            summary: 'Login user',
            description: 'Authenticate user and get JWT token',
            tags: ['Users'],
          },
        },
      )
      .post(
        '/change-password',
        async ({headers, jwt, body, set}): Promise<{message: string}> => {
          return {message: 'Backend not implemented'};
          const payload = await verifyAuth(headers.authorization, jwt, set);
          const password = body.password;
          const newPassword = body.newPassword;
          // await userService.changePassword(payload.unitId, password, newPassword);
          return {message: 'Password changed successfully'};
        },
        {
          body: t.Object({
            password: t.String(),
            newPassword: t.String(),
          }),
          detail: {
            summary: 'Change password',
            description: 'Change password for current user',
            tags: ['Users'],
          },
        },
      )

      .post(
        'reset-password',
        async ({body, set}): Promise<{message: string}> => {
          const email = body.email;
          const verificationCode = body.verificationCode;
          const newPassword = body.newPassword;
          await userService.resetPassword(email, verificationCode, newPassword);
          return {message: 'Password reset successfully'};
        },
        {
          body: t.Object({
            email: t.String(),
            verificationCode: t.String(),
            newPassword: t.String(),
          }),
          detail: {
            summary: 'Reset password',
            description: 'Reset password for user',
            tags: ['Users'],
          },
        },
      )
      /**
       * Get current user profile (requires JWT)
       * GET /users/me
       */
      .get(
        '/me',
        async ({headers, jwt, set}): Promise<UserDTO> => {
          const payload = await verifyAuth(headers.authorization, jwt, set);
          const user = await userService.getByUnitId(payload.unitId);
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
        async ({headers, jwt, set}): Promise<JWTPayload> => {
          const payload = await verifyAuth<JWTPayload>(
            headers.authorization,
            jwt,
            set,
          );
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
        }): Promise<{users: Omit<UserDTO, 'email'>[]; total: number}> => {
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
        async ({headers, jwt, body, set}): Promise<UserDTO> => {
          const payload = await verifyAuth(headers.authorization, jwt, set);

          let passwordHash: string | undefined = undefined;
          if (body.password) {
            passwordHash = await hashPassword(body.password);
          }
          const userReq: UpdateUser = {
            name: body.name,
            avatar: body.avatar,
            bio: body.bio,
            password: passwordHash,
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
        async ({headers, jwt, params, body, set}): Promise<UserDTO> => {
          const payload = await verifyAuth(headers.authorization, jwt, set);

          // Only allow users to update their own profile
          if (!hasPermissionToUpdateUser(payload as any, params.unitId)) {
            set.status = 403;
            throw new Error('Forbidden: Cannot update other users');
          }

          let passwordHash: string | undefined = undefined;
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
        async ({headers, jwt, set}): Promise<{message: string}> => {
          const payload = await verifyAuth(headers.authorization, jwt, set);
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
        async ({headers, jwt, params, set}): Promise<{message: string}> => {
          const payload = await verifyAuth(headers.authorization, jwt, set);

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
