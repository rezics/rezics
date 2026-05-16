/**
 * User API client functions
 * Direct API communication layer
 */

import type {
  UpdateUser,
  UpdateUserSettings,
  UserDTO,
  UserEmailVerificationConfirmBody,
  UserEmailVerificationRequestBody,
  UserEmailVerificationResponse,
  UserEmailVerificationState,
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

  adminGet: async (userId: string): Promise<UserDTO> => {
    return apiFetch(`/user/admin/${userId}`);
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
  adminUpdate: async (userId: string, input: UpdateUser): Promise<UserDTO> => {
    return apiFetch(`/user/admin/${userId}`, {
      method: "PUT",
      body: JSON.stringify(input),
    });
  },

  get: async (userId: string): Promise<UserDTO> => {
    return apiFetch(`/user/${userId}`);
  },

  getBySlug: async (userSlug: string): Promise<UserDTO> => {
    return apiFetch(`/user/by-slug/${userSlug}`);
  },

  updateMe: async (input: UpdateUser): Promise<UserDTO> => {
    return apiFetch(`/user/me`, {
      method: "PUT",
      body: JSON.stringify(input),
    });
  },

  update: async (userId: string, input: UpdateUser): Promise<UserDTO> => {
    return apiFetch(`/user/${userId}`, {
      method: "PUT",
      body: JSON.stringify(input),
    });
  },

  deleteMe: async (): Promise<{ message: string }> => {
    return apiFetch(`/user/me`, { method: "DELETE" });
  },

  delete: async (userId: string): Promise<{ message: string }> => {
    return apiFetch(`/user/${userId}`, { method: "DELETE" });
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
    userId: string,
    query?: { page?: number; limit?: number },
  ): Promise<{ users: UserDTO[]; total: number }> => {
    const qs = query ? `?${new URLSearchParams(query as any).toString()}` : "";
    return apiFetch(`/user/${userId}/followers${qs}`);
  },

  getFollowings: async (
    userId: string,
    query?: { page?: number; limit?: number },
  ): Promise<{ users: UserDTO[]; total: number }> => {
    const qs = query ? `?${new URLSearchParams(query as any).toString()}` : "";
    return apiFetch(`/user/${userId}/followings${qs}`);
  },

  batch: async (
    ids: string[],
  ): Promise<
    Record<string, { name?: string; slug?: string; avatar: string | null }>
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

  getEmailVerificationState: async (): Promise<UserEmailVerificationState> => {
    return apiFetch(`/user/me/email-verification`);
  },

  requestEmailVerification: async (
    input: UserEmailVerificationRequestBody,
  ): Promise<UserEmailVerificationResponse> => {
    return apiFetch(`/user/me/email-verification`, {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  verifyEmailContract: async (
    input: UserEmailVerificationConfirmBody,
  ): Promise<UserEmailVerificationResponse> => {
    return apiFetch(`/user/me/email-verification/verify`, {
      method: "POST",
      body: JSON.stringify(input),
    });
  },
};
