/**
 * User API client functions
 * Direct API communication layer
 */

import type {
  CreateUserInput,
  UpdateUserInput,
  UserDTO,
} from '@package/contract';
import {apiFetch} from '../react-query/http';

export const userApi = {
  register: async (
    input: CreateUserInput,
  ): Promise<{user: UserDTO; token: string}> => {
    return apiFetch(`/users/register`, {
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
    return apiFetch(`/users${qs}`);
  },

  get: async (unitId: string): Promise<Omit<UserDTO, 'email'>> => {
    return apiFetch(`/users/${unitId}`);
  },

  updateMe: async (input: UpdateUserInput): Promise<UserDTO> => {
    return apiFetch(`/users/me`, {
      method: 'PUT',
      body: JSON.stringify(input),
    });
  },

  update: async (unitId: string, input: UpdateUserInput): Promise<UserDTO> => {
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
