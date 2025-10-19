import type {
  CreateUserInput,
  UpdateUserInput,
  UserDTO,
} from '@package/contract';
import {userService} from './user.service';
import {mapUserToDTO, mapUserToPublicProfile} from './mapper';
import type {JWTPayload} from './types';

// Helper function to extract and verify JWT from Authorization header
async function verifyAuth(
  authorization: string | undefined,
  jwtInstance: any,
  set: any,
): Promise<JWTPayload> {
  if (!authorization) {
    set.status = 401;
    throw new Error('Unauthorized: No authorization header provided');
  }

  // Extract token from "Bearer <token>" format
  const token = authorization.startsWith('Bearer ')
    ? authorization.slice(7)
    : authorization;

  const payload = (await jwtInstance.verify(token)) as JWTPayload | false;
  if (!payload) {
    set.status = 401;
    throw new Error('Unauthorized: Invalid token');
  }

  return payload;
}

import {
  userListQuerySchema,
  userParamsSchema,
  createUserSchema,
  updateUserSchema,
  loginSchema,
} from '@package/contract';

import {coreInstance} from '../core';

/**
 * User Controller - Elysia.js routes with JWT authentication
 */
export const userApi = coreInstance('/users')
  /**
   * Register new user (public)
   * POST /users/register
   */
  .post(
    '/register',
    async ({body, jwt}): Promise<{user: UserDTO; token: string}> => {
      const userReq: CreateUserInput = {
        email: body.email,
        password: body.password,
        name: body.name,
        avatar: body.avatar,
        bio: body.bio,
      };

      const user = await userService.create(userReq);

      // Generate JWT token
      const token = await jwt.sign({
        userId: user.unitId,
        email: user.email,
        name: user.name,
      } as JWTPayload);

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
    async ({body, jwt}): Promise<{user: UserDTO; token: string}> => {
      const user = await userService.authenticate(body.email, body.password);

      if (!user) {
        throw new Error(`Invalid email or password: ${body.email}`);
      }

      // Generate JWT token
      const token = await jwt.sign({
        userId: user.unitId,
        email: user.email,
        name: user.name,
      } as JWTPayload);

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
   * Get current user profile (requires JWT)
   * GET /users/me
   */
  .get(
    '/me',
    async ({headers, jwt, set}): Promise<UserDTO> => {
      const payload = await verifyAuth(headers.authorization, jwt, set);
      const user = await userService.getByUnitId(payload.userId);
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
      const payload = await verifyAuth(headers.authorization, jwt, set);
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

      const user = await userService.update(payload.userId, userReq);
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
      if (payload.userId !== params.unitId) {
        set.status = 403;
        throw new Error('Forbidden: Cannot update other users');
      }

      const userReq: UpdateUserInput = {
        name: body.name,
        avatar: body.avatar,
        bio: body.bio,
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
      await userService.delete(payload.userId);
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

      // Only allow users to delete their own profile
      if (payload.userId !== params.unitId) {
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
