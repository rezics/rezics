import type {
  CreateUserInput,
  UpdateUserInput,
  UserDTO,
} from '@package/contract';
import {userService} from './user.service';
import {mapUserToDTO, mapUserToPublicProfile} from './mapper';
import type {JWTPayload, RefreshTokenPayload} from './types';
import {sessionService} from './session.service';

import {v7 as uuidv7} from 'uuid';

import {verifyAuth} from '@/src/utils/authUtils';

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

import {allowEmailDomains} from './allowEmailDomains';
import {verifyTurnstileToken} from '../utils/turnstileUtils';

/**
 * User Controller - Elysia.js routes with JWT authentication
 */
export const userApi = coreInstance('/users')
  // ANCHOR User Core
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

      const userReq: CreateUserInput = {
        email: body.email,
        password: body.password,
        slug: body.slug,
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
      const user = await userService.authenticate(body.email, body.password);

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

  /**
   * Refresh token
   * POST /users/refresh-token
   */
  .post(
    '/refresh-token',
    async ({
      headers,
      jwt,
      refreshToken,
      set,
      cookie: {refresh_token},
    }): Promise<{token: string}> => {
      const refreshTokenCookieValue = refresh_token?.value as string;
      const payload = await verifyAuth<RefreshTokenPayload>(
        refreshTokenCookieValue,
        refreshToken,
        set,
      );

      console.log('generate new token', payload);

      // 基于数据库会话进行二次校验（哈希比对 / 过期 / 撤销等）
      const validation = await sessionService.validateAndMarkUsed({
        sessionId: payload.sessionId,
        refreshToken: headers.refreshToken ?? '',
      });

      if (!validation.valid) {
        set.status = 401;
        throw new Error(
          `Unauthorized: Refresh session invalid (${validation.reason})`,
        );
      }

      // 优先使用会话中的 userId，确保与数据库一致
      const userId = validation.session.userId ?? payload.unitId;
      const user = await userService.getByUnitId(userId);
      const token = await jwt.sign({
        unitId: user.unitId,
        email: user.email,
        slug: user.slug,
        permission: user.permission,
      } as JWTPayload);

      const newSessionId = uuidv7();
      const newRefreshTokenSign = await refreshToken.sign({
        sessionId: newSessionId,
        unitId: user.unitId,
        type: 'refreshToken',
      } as RefreshTokenPayload);
      await sessionService.createSession({
        sessionId: newSessionId,
        userId: user.unitId,
        refreshToken: newRefreshTokenSign,
      });

      setCookie(refresh_token!, {
        value: newRefreshTokenSign,
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        path: '/users/refresh-token',
        maxAge: 60 * 60 * 24 * 30,
      });

      return {
        token: token,
      };
    },
    {
      detail: {
        summary: 'Refresh token',
        description: 'Refresh JWT token',
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
      const {users, total} = await userService.list(query);
      return {users: users.map(mapUserToPublicProfile), total};
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

  // ANCHOR Verification Code Logic
  /**
   * Send verification code
   * POST /users/send-verification-code
   */
  .post(
    '/send-verification-code',
    async ({body, set}) => {
      const email = body.email;
      const turnstileToken = body.turnstileToken;
      if (turnstileToken) {
        const result = await verifyTurnstileToken(turnstileToken);
        if (!result.success) {
          set.status = 400;
          throw new Error('Bot detected');
        }
      }

      if (
        !allowEmailDomains.includes(
          email.split('@')[1] ?? 'invalid-email-domain',
        )
      ) {
        set.status = 400;
        throw new Error('Invalid email domain');
      }
      const result = await userService.sendVerificationCode(email);
      if (result.status === 'error') {
        set.status = 400;
        throw new Error(result.data);
      }
      return {data: {status: 'success', info: result.data}};
    },
    {
      body: t.Object({
        email: t.String(),
        turnstileToken: t.Optional(t.String()),
      }),
      detail: {
        summary: 'Send verification code',
        description: 'Send verification code to user',
        tags: ['Users', 'Verification Code'],
      },
    },
  )

  /**
   * Verify verification code
   * POST /users/verify-verification-code
   */
  .post(
    '/verify-verification-code',
    async ({headers, jwt, body, set}) => {
      const payload = await verifyAuth<JWTPayload>(
        headers.authorization,
        jwt,
        set,
      );
      const email = payload.email;
      await userService.verifyVerificationCode(email, body.code);
    },
    {
      body: t.Object({
        code: t.String(),
      }),
      detail: {
        summary: 'Verify verification code',
        description: 'Verify verification code',
        tags: ['Users', 'Verification Code'],
      },
    },
  )

  // ANCHOR Follow Logic

  /**
   * Follow a user
   * POST /users/follow/:targetId
   */
  .post(
    '/follow/:targetId',
    async ({headers, jwt, params, set}) => {
      const payload = await verifyAuth(headers.authorization, jwt, set);
      await userService.follow(payload.unitId, params.targetId);
      return {message: 'Followed successfully'};
    },
    {
      params: t.Object({
        targetId: t.String(),
      }),
      detail: {
        summary: 'Follow user',
        description: 'Follow a user',
        tags: ['Users', 'Follow'],
      },
    },
  )

  /**
   * Unfollow a user
   * DELETE /users/follow/:targetId
   */
  .delete(
    '/follow/:targetId',
    async ({headers, jwt, params, set}) => {
      const payload = await verifyAuth(headers.authorization, jwt, set);
      await userService.unfollow(payload.unitId, params.targetId);
      return {message: 'Unfollowed successfully'};
    },
    {
      params: t.Object({
        targetId: t.String(),
      }),
      detail: {
        summary: 'Unfollow user',
        description: 'Unfollow a user',
        tags: ['Users', 'Follow'],
      },
    },
  )

  /**
   * Get follow status for current user
   * GET /users/follow/status?targetIds=...
   */
  .get(
    '/follow/status',
    async ({headers, jwt, query, set}) => {
      const payload = await verifyAuth(headers.authorization, jwt, set);
      const {targetIds} = query;

      let ids: string[] = [];
      if (targetIds) {
        ids = Array.isArray(targetIds) ? targetIds : [targetIds];
      }

      const status = await userService.getFollowStatus(payload.unitId, ids);
      return status;
    },
    {
      query: t.Object({
        targetIds: t.Optional(t.Union([t.String(), t.Array(t.String())])),
      }),
      detail: {
        summary: 'Get follow status',
        description: 'Check if current user follows specified targets',
        tags: ['Users', 'Follow'],
      },
    },
  )

  .get(
    '/follow/summary',
    async ({headers, jwt, query, set}) => {
      await verifyAuth(headers.authorization, jwt, set);
      const {targetIds} = query;

      let ids: string[] = [];
      if (targetIds) {
        ids = Array.isArray(targetIds) ? targetIds : [targetIds];
      }

      if (!ids.length) {
        return {
          targetIds: [],
          followers: {},
        } as {
          targetIds: string[];
          followers: Record<string, number>;
        };
      }

      const followers = await userService.getFollowSummary(ids);
      return {
        targetIds: ids,
        followers,
      } as {
        targetIds: string[];
        followers: Record<string, number>;
      };
    },
    {
      query: t.Object({
        targetIds: t.Optional(t.Union([t.String(), t.Array(t.String())])),
      }),
      detail: {
        summary: 'Get follow summary',
        description: 'Get follower counts for one or many target users',
        tags: ['Users', 'Follow'],
      },
    },
  )

  /**
   * Get followers of a user
   * GET /users/:unitId/followers
   */
  .get(
    '/:unitId/followers',
    async ({params, query}) => {
      const {users, total} = await userService.getFollowers(
        params.unitId,
        query,
      );
      return {users: users.map(mapUserToPublicProfile), total};
    },
    {
      params: userParamsSchema,
      query: t.Object({
        page: t.Optional(t.Numeric()),
        limit: t.Optional(t.Numeric()),
      }),
      detail: {
        summary: 'Get followers',
        description: 'Get followers of a user',
        tags: ['Users', 'Follow'],
      },
    },
  )

  /**
   * Get followings of a user
   * GET /users/:unitId/followings
   */
  .get(
    '/:unitId/followings',
    async ({params, query}) => {
      const {users, total} = await userService.getFollowings(
        params.unitId,
        query,
      );
      return {users: users.map(mapUserToPublicProfile), total};
    },
    {
      params: userParamsSchema,
      query: t.Object({
        page: t.Optional(t.Numeric()),
        limit: t.Optional(t.Numeric()),
      }),
      detail: {
        summary: 'Get followings',
        description: 'Get followings of a user',
        tags: ['Users', 'Follow'],
      },
    },
  )

  /**
   * Get user by unitId (public, returns public profile)
   * GET /users/:unitId
   */
  .get(
    '/:unitId',
    async ({params}): Promise<Omit<UserDTO, 'email'>> => {
      const user = await userService.getByUnitId(params.unitId);
      return mapUserToPublicProfile(user);
    },
    {
      params: userParamsSchema,
      detail: {
        summary: 'Get user',
        description: 'Get a single user by unit ID',
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

      const userReq: UpdateUserInput = {
        name: body.name,
        avatar: body.avatar,
        bio: body.bio,
        password: body.password,
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

      const userReq: UpdateUserInput = {
        name: body.name,
        avatar: body.avatar,
        bio: body.bio,
        description: body.description,
        password: body.password,
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
  );
