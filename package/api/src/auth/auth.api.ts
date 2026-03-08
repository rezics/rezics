/**
 * Auth API client functions
 * Direct API communication layer targeting the auth server
 */

import {env} from '@package/app/env';
import type {
  AuthTokenResponse,
  AuthResponse,
  AuthSession,
  AuthUser,
  RequestPasswordResetBody,
  RequestPasswordResetResponse,
  ResetPasswordBody,
  ResetPasswordResponse,
  SignInBody,
} from '@package/contract';

const AUTH_BASE_URL = env.VITE_AUTH_API_URL || 'http://localhost:3001';

async function authFetch<T>(
  endpoint: string,
  options?: globalThis.RequestInit,
): Promise<T> {
  const url = `${AUTH_BASE_URL}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...((options?.headers as Record<string, string>) ?? {}),
    },
  });

  const json = await response.json();

  if (!response.ok) {
    throw new Error(
      JSON.stringify({
        status: response.status,
        message: json?.message ?? response.statusText,
      }),
    );
  }

  return json;
}

export const authApi = {
  signIn: async (input: SignInBody): Promise<AuthResponse> => {
    return authFetch<AuthResponse>('/api/auth/sign-in/email', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  signUp: async (input: {
    email: string;
    password: string;
    slug: string;
  }): Promise<AuthResponse> => {
    return authFetch<AuthResponse>('/api/auth/sign-up/email', {
      method: 'POST',
      body: JSON.stringify({
        email: input.email,
        password: input.password,
        name: input.slug,
      }),
    });
  },

  signOut: async (): Promise<{success: boolean}> => {
    return authFetch<{success: boolean}>('/api/auth/sign-out', {
      method: 'POST',
    });
  },

  getSession: async (): Promise<{session: AuthSession; user: AuthUser}> => {
    return authFetch<{session: AuthSession; user: AuthUser}>(
      '/api/auth/get-session',
    );
  },

  getToken: async (): Promise<AuthTokenResponse> => {
    return authFetch<AuthTokenResponse>('/api/auth/token');
  },

  requestPasswordReset: async (
    input: RequestPasswordResetBody,
  ): Promise<RequestPasswordResetResponse> => {
    return authFetch<RequestPasswordResetResponse>(
      '/api/auth/request-password-reset',
      {
        method: 'POST',
        body: JSON.stringify(input),
      },
    );
  },

  resetPassword: async (
    input: ResetPasswordBody,
  ): Promise<ResetPasswordResponse> => {
    return authFetch<ResetPasswordResponse>('/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  listSessions: async () => {
    return authFetch<{sessions: any[]}>('/api/auth/list-sessions', {
      method: 'POST',
    });
  },

  revokeSession: async (input: {token: string}) => {
    return authFetch<{success: boolean}>('/api/auth/revoke-session', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  adminListUsers: async () => {
    return authFetch<{users: any[]}>('/api/auth/admin/list-users');
  },

  adminRemoveUser: async (input: {userId: string}) => {
    return authFetch<{success: boolean}>('/api/auth/admin/remove-user', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  adminBanUser: async (input: {userId: string; reason?: string}) => {
    return authFetch<{success: boolean}>('/api/auth/admin/ban-user', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  adminUnbanUser: async (input: {userId: string}) => {
    return authFetch<{success: boolean}>('/api/auth/admin/unban-user', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  adminSetRole: async (input: {userId: string; role: string}) => {
    return authFetch<{success: boolean}>('/api/auth/admin/set-role', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },
};
