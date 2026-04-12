/**
 * User API client functions
 * Direct API communication layer
 */

import type {
  EnsureUserResponse,
  SessionTokenResponse,
  UpdateUser,
  UserDTO,
} from "@rezics/contract";
import { NormalizedTokenName } from "@rezics/contract";
import { apiFetch } from "../react-query/http";

type FollowSummaryResponse = {
  targetIds: string[];
  followers: Record<string, number>;
};

export const userApi = {
  ensure: async (contextToken: string): Promise<EnsureUserResponse> => {
    return apiFetch(`/users/ensure`, {
      includeTokens: [
        NormalizedTokenName.AUTH_IDENTITY,
        NormalizedTokenName.REZICS_SESSION,
      ],
      headers: {
        "x-auth-context-token": contextToken,
      },
    });
  },

  issueSessionToken: async (): Promise<SessionTokenResponse> => {
    return apiFetch(`/session/token`, {
      method: "POST",
    });
  },

  me: async (): Promise<UserDTO> => {
    return apiFetch(`/users/me`);
  },

  list: async (
    query?: Record<string, unknown>,
  ): Promise<{ users: Omit<UserDTO, "email">[]; total: number }> => {
    const qs = query
      ? `?${new URLSearchParams(query as Record<string, string>).toString()}`
      : "";
    return apiFetch(`/meili/users/search${qs}`);
  },

  /**
   * Admin: list users (includes email).
   */
  adminList: async (
    query?: Record<string, unknown>,
  ): Promise<{ users: UserDTO[]; total: number }> => {
    const qs = query
      ? `?${new URLSearchParams(query as Record<string, string>).toString()}`
      : "";
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
      method: "PUT",
      body: JSON.stringify(input),
    });
  },

  get: async (unitId: string): Promise<UserDTO> => {
    return apiFetch(`/users/${unitId}`);
  },

  updateMe: async (input: UpdateUser): Promise<UserDTO> => {
    return apiFetch(`/users/me`, {
      method: "PUT",
      body: JSON.stringify(input),
    });
  },

  update: async (unitId: string, input: UpdateUser): Promise<UserDTO> => {
    return apiFetch(`/users/${unitId}`, {
      method: "PUT",
      body: JSON.stringify(input),
    });
  },

  deleteMe: async (): Promise<{ message: string }> => {
    return apiFetch(`/users/me`, { method: "DELETE" });
  },

  delete: async (unitId: string): Promise<{ message: string }> => {
    return apiFetch(`/users/${unitId}`, { method: "DELETE" });
  },

  follow: async (targetId: string): Promise<{ message: string }> => {
    return apiFetch(`/users/follow/${targetId}`, { method: "POST" });
  },

  unfollow: async (targetId: string): Promise<{ message: string }> => {
    return apiFetch(`/users/follow/${targetId}`, { method: "DELETE" });
  },

  getFollowStatus: async (
    targetIds: string[],
  ): Promise<Record<string, boolean>> => {
    const qs = new URLSearchParams();
    for (const id of targetIds) qs.append("targetIds", id);
    return apiFetch(`/users/follow/status?${qs.toString()}`);
  },

  getFollowSummary: async (
    targetIds: string[],
  ): Promise<FollowSummaryResponse> => {
    const qs = new URLSearchParams();
    for (const id of targetIds) qs.append("targetIds", id);
    return apiFetch<FollowSummaryResponse>(
      `/users/follow/summary?${qs.toString()}`,
    );
  },

  getFollowers: async (
    unitId: string,
    query?: { page?: number; limit?: number },
  ): Promise<{ users: UserDTO[]; total: number }> => {
    const qs = query ? `?${new URLSearchParams(query as any).toString()}` : "";
    return apiFetch(`/users/${unitId}/followers${qs}`);
  },

  getFollowings: async (
    unitId: string,
    query?: { page?: number; limit?: number },
  ): Promise<{ users: UserDTO[]; total: number }> => {
    const qs = query ? `?${new URLSearchParams(query as any).toString()}` : "";
    return apiFetch(`/users/${unitId}/followings${qs}`);
  },

  batch: async (
    ids: string[],
  ): Promise<Record<string, { name: string; slug: string; avatar: string }>> => {
    return apiFetch(`/users/batch?ids=${ids.join(",")}`);
  },
};
