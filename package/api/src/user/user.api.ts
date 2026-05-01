/**
 * User API client functions
 * Direct API communication layer
 */

import type {
  UpdateUser,
  UpdateUserSettings,
  UserDTO,
  UserSettings,
} from "@rezics/contract";
import { apiFetch } from "../react-query/http";

type FollowSummaryResponse = {
  targetIds: string[];
  followers: Record<string, number>;
};

export const userApi = {
  me: async (): Promise<UserDTO> => {
    return apiFetch(`/user/me`);
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
    return apiFetch(`/user/admin${qs}`);
  },

  adminGet: async (unitId: string): Promise<UserDTO> => {
    return apiFetch(`/user/admin/${unitId}`);
  },

  /**
   * Admin: create user.
   */
  // MOCK: backend admin-create-user endpoint not yet implemented; replace POST body once contract lands
  adminCreate: async (input: {
    email: string;
    password: string;
    slug: string;
    avatar?: string;
    bio?: string;
  }): Promise<UserDTO> => {
    return apiFetch(`/user/admin`, {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  /**
   * Admin: update user.
   */
  adminUpdate: async (unitId: string, input: UpdateUser): Promise<UserDTO> => {
    return apiFetch(`/user/admin/${unitId}`, {
      method: "PUT",
      body: JSON.stringify(input),
    });
  },

  get: async (unitId: string): Promise<UserDTO> => {
    return apiFetch(`/user/${unitId}`);
  },

  updateMe: async (input: UpdateUser): Promise<UserDTO> => {
    return apiFetch(`/user/me`, {
      method: "PUT",
      body: JSON.stringify(input),
    });
  },

  update: async (unitId: string, input: UpdateUser): Promise<UserDTO> => {
    return apiFetch(`/user/${unitId}`, {
      method: "PUT",
      body: JSON.stringify(input),
    });
  },

  deleteMe: async (): Promise<{ message: string }> => {
    return apiFetch(`/user/me`, { method: "DELETE" });
  },

  delete: async (unitId: string): Promise<{ message: string }> => {
    return apiFetch(`/user/${unitId}`, { method: "DELETE" });
  },

  follow: async (targetId: string): Promise<{ message: string }> => {
    return apiFetch(`/user/follow/${targetId}`, { method: "POST" });
  },

  unfollow: async (targetId: string): Promise<{ message: string }> => {
    return apiFetch(`/user/follow/${targetId}`, { method: "DELETE" });
  },

  getFollowStatus: async (
    targetIds: string[],
  ): Promise<Record<string, boolean>> => {
    const qs = new URLSearchParams();
    for (const id of targetIds) qs.append("targetIds", id);
    return apiFetch(`/user/follow/status?${qs.toString()}`);
  },

  getFollowSummary: async (
    targetIds: string[],
  ): Promise<FollowSummaryResponse> => {
    const qs = new URLSearchParams();
    for (const id of targetIds) qs.append("targetIds", id);
    return apiFetch<FollowSummaryResponse>(
      `/user/follow/summary?${qs.toString()}`,
    );
  },

  getFollowers: async (
    unitId: string,
    query?: { page?: number; limit?: number },
  ): Promise<{ users: UserDTO[]; total: number }> => {
    const qs = query ? `?${new URLSearchParams(query as any).toString()}` : "";
    return apiFetch(`/user/${unitId}/followers${qs}`);
  },

  getFollowings: async (
    unitId: string,
    query?: { page?: number; limit?: number },
  ): Promise<{ users: UserDTO[]; total: number }> => {
    const qs = query ? `?${new URLSearchParams(query as any).toString()}` : "";
    return apiFetch(`/user/${unitId}/followings${qs}`);
  },

  batch: async (
    ids: string[],
  ): Promise<
    Record<string, { name: string; slug: string; avatar: string }>
  > => {
    return apiFetch(`/user/batch?ids=${ids.join(",")}`);
  },

  getSettings: async (): Promise<UserSettings> => {
    return apiFetch(`/user/me/settings`);
  },

  updateSettings: async (input: UpdateUserSettings): Promise<UserSettings> => {
    return apiFetch(`/user/me/settings`, {
      method: "PUT",
      body: JSON.stringify(input),
    });
  },
};
