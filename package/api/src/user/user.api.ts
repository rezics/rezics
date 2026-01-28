/**
 * User API client functions
 * Direct API communication layer
 */

import type {CreateUser, UpdateUser, UserDTO} from '@package/contract';
import {apiFetch} from '../react-query/http';

type FollowSummaryResponse = {
  targetIds: string[];
  followers: Record<string, number>;
};

export const userApi = {
  /**
   * Reset password with verification code.
   */
  resetPassword: async (input: {
    email: string;
    verificationCode: string;
    newPassword: string;
  }): Promise<{message: string}> => {
    return apiFetch(`/users/reset-password`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  register: async (
    input: CreateUser,
  ): Promise<{user: UserDTO; token: string}> => {
    return apiFetch(`/users/register`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  /**
   * Send verification code to user email.
   * Optionally includes a Turnstile token for bot protection.
   */
  sendVerificationCode: async (input: {
    email: string;
    turnstileToken?: string;
  }): Promise<{data: {status: string; info: string}}> => {
    return apiFetch(`/users/send-verification-code`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  login: async (input: {
    email: string;
    password: string;
  }): Promise<{user: UserDTO; token: string}> => {
    return apiFetch(`/users/login`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  me: async (): Promise<UserDTO> => {
    return apiFetch(`/users/me`);
  },

  jwtPayload: async (): Promise<any> => {
    return apiFetch(`/users/me/jwt-payload`);
  },

  list: async (
    query?: Record<string, unknown>,
  ): Promise<{users: Omit<UserDTO, 'email'>[]; total: number}> => {
    const qs = query
      ? `?${new URLSearchParams(query as Record<string, string>).toString()}`
      : '';
    return apiFetch(`/meili/users/search${qs}`);
  },

  /**
   * Admin: list users (includes email).
   */
  adminList: async (
    query?: Record<string, unknown>,
  ): Promise<{users: UserDTO[]; total: number}> => {
    const qs = query
      ? `?${new URLSearchParams(query as Record<string, string>).toString()}`
      : '';
    return apiFetch(`/users/admin${qs}`);
  },

  /**
   * Admin: get user detail (includes email).
   */
  adminGet: async (unitId: string): Promise<UserDTO> => {
    return apiFetch(`/users/admin/${unitId}`);
  },

  /**
   * Admin: create user.
   */
  adminCreate: async (input: CreateUser): Promise<UserDTO> => {
    return apiFetch(`/users/admin`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  /**
   * Admin: update user.
   */
  adminUpdate: async (unitId: string, input: UpdateUser): Promise<UserDTO> => {
    return apiFetch(`/users/admin/${unitId}`, {
      method: 'PUT',
      body: JSON.stringify(input),
    });
  },

  /**
   * Create user (legacy route, requires admin permission).
   */
  create: async (
    input: CreateUser,
  ): Promise<{user: UserDTO; token: string}> => {
    return apiFetch(`/users/create`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  get: async (unitId: string): Promise<Omit<UserDTO, 'email'>> => {
    return apiFetch(`/users/${unitId}`);
  },

  updateMe: async (input: UpdateUser): Promise<UserDTO> => {
    return apiFetch(`/users/me`, {
      method: 'PUT',
      body: JSON.stringify(input),
    });
  },

  update: async (unitId: string, input: UpdateUser): Promise<UserDTO> => {
    return apiFetch(`/users/${unitId}`, {
      method: 'PUT',
      body: JSON.stringify(input),
    });
  },

  deleteMe: async (): Promise<{message: string}> => {
    return apiFetch(`/users/me`, {method: 'DELETE'});
  },

  delete: async (unitId: string): Promise<{message: string}> => {
    return apiFetch(`/users/${unitId}`, {method: 'DELETE'});
  },

  follow: async (targetId: string): Promise<{message: string}> => {
    return apiFetch(`/users/follow/${targetId}`, {method: 'POST'});
  },

  unfollow: async (targetId: string): Promise<{message: string}> => {
    return apiFetch(`/users/follow/${targetId}`, {method: 'DELETE'});
  },

  getFollowStatus: async (
    targetIds: string[],
  ): Promise<Record<string, boolean>> => {
    const qs = new URLSearchParams();
    targetIds.forEach(id => qs.append('targetIds', id));
    return apiFetch(`/users/follow/status?${qs.toString()}`);
  },

  getFollowSummary: async (
    targetIds: string[],
  ): Promise<FollowSummaryResponse> => {
    const qs = new URLSearchParams();
    targetIds.forEach(id => qs.append('targetIds', id));
    return apiFetch<FollowSummaryResponse>(
      `/users/follow/summary?${qs.toString()}`,
    );
  },

  getFollowers: async (
    unitId: string,
    query?: {page?: number; limit?: number},
  ): Promise<{users: Omit<UserDTO, 'email'>[]; total: number}> => {
    const qs = query ? `?${new URLSearchParams(query as any).toString()}` : '';
    return apiFetch(`/users/${unitId}/followers${qs}`);
  },

  getFollowings: async (
    unitId: string,
    query?: {page?: number; limit?: number},
  ): Promise<{users: Omit<UserDTO, 'email'>[]; total: number}> => {
    const qs = query ? `?${new URLSearchParams(query as any).toString()}` : '';
    return apiFetch(`/users/${unitId}/followings${qs}`);
  },
};
