/**
 * User API client functions
 * Direct API communication layer
 */

import type {UpdateUser, UserDTO} from '@package/contract';
import {NormalizedTokenName, normalizedTokenTransportMap} from '@package/contract';
import {apiFetch, apiFetchResponse} from '../react-query/http';

type FollowSummaryResponse = {
  targetIds: string[];
  followers: Record<string, number>;
};

export const userApi = {
  ensure: async (): Promise<{user: UserDTO; sessionToken: string | null}> => {
    const {data, response} = await apiFetchResponse<UserDTO>(`/users/ensure`);
    return {
      user: data,
      sessionToken:
        response.headers.get(
          normalizedTokenTransportMap[NormalizedTokenName.REZICS_SESSION]
            .headerName,
        ) ?? null,
    };
  },

  refreshSession: async (): Promise<{ok: true; sessionToken: string | null}> => {
    const {data, response} = await apiFetchResponse<{ok: true}>(
      `/users/session/refresh`,
    );
    return {
      ok: data.ok,
      sessionToken:
        response.headers.get(
          normalizedTokenTransportMap[NormalizedTokenName.REZICS_SESSION]
            .headerName,
        ) ?? null,
    };
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

  adminGet: async (unitId: string): Promise<UserDTO> => {
    return apiFetch(`/users/admin/${unitId}`);
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

  get: async (unitId: string): Promise<UserDTO> => {
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
  ): Promise<{users: UserDTO[]; total: number}> => {
    const qs = query ? `?${new URLSearchParams(query as any).toString()}` : '';
    return apiFetch(`/users/${unitId}/followers${qs}`);
  },

  getFollowings: async (
    unitId: string,
    query?: {page?: number; limit?: number},
  ): Promise<{users: UserDTO[]; total: number}> => {
    const qs = query ? `?${new URLSearchParams(query as any).toString()}` : '';
    return apiFetch(`/users/${unitId}/followings${qs}`);
  },
};
