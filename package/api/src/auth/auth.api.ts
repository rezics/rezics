/**
 * Auth API client functions
 * Direct API communication layer targeting the main public auth boundary.
 */

import type {
  AuthProvider,
  AuthResponse,
  AuthSession,
  AuthTokenResponse,
  AuthUser,
  ChangeEmailBody,
  ChangeEmailResponse,
  CheckSlugResponse,
  GetSessionStateResponse,
  IdentityConfirmBody,
  IdentityConfirmResponse,
  RequestPasswordResetBody,
  RequestPasswordResetResponse,
  ResetPasswordBody,
  ResetPasswordResponse,
  SendVerificationEmailBody,
  SendVerificationEmailResponse,
  SetPasswordBody,
  SetPasswordResponse,
  SignInBody,
  SignInSocialBody,
  SignInSocialResponse,
} from "@rezics/contract";
import { getApiConfig } from "../config";

function getAuthBaseUrl(): string {
  const config = getApiConfig();
  return config.authBaseUrl || config.apiBaseUrl;
}

async function authFetch<T>(
  endpoint: string,
  options?: RequestInit,
): Promise<T> {
  const url = `${getAuthBaseUrl()}${endpoint}`;
  const existingHeaders = new Headers(options?.headers);
  const response = await fetch(url, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...Object.fromEntries(existingHeaders.entries()),
    },
  });

  const json = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      JSON.stringify({
        status: response.status,
        message: json?.message ?? response.statusText,
      }),
    );
  }

  return json as T;
}

export const authApi = {
  signIn: async (input: SignInBody): Promise<AuthResponse> => {
    return authFetch<AuthResponse>("/auth/sign-in/email", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  signUp: async (input: {
    email: string;
    password: string;
  }): Promise<AuthResponse> => {
    const inferredName = input.email.split("@")[0]?.trim() || "Reader";

    return authFetch<AuthResponse>("/auth/sign-up/email", {
      method: "POST",
      body: JSON.stringify({
        email: input.email,
        password: input.password,
        name: inferredName,
      }),
    });
  },

  signOut: async (): Promise<{ success: boolean }> => {
    return authFetch<{ success: boolean }>("/auth/sign-out", {
      method: "POST",
    });
  },

  getSession: async (): Promise<{ session: AuthSession; user: AuthUser }> => {
    return authFetch<{ session: AuthSession; user: AuthUser }>(
      "/auth/get-session",
    );
  },

  getSessionState: async (): Promise<GetSessionStateResponse> => {
    return authFetch<GetSessionStateResponse>("/auth/get-session-state");
  },

  getToken: async (): Promise<AuthTokenResponse> => {
    return authFetch<AuthTokenResponse>("/auth/token");
  },

  listProviders: async (): Promise<{ providers: AuthProvider[] }> => {
    return authFetch<{ providers: AuthProvider[] }>("/auth/providers");
  },

  signInSocial: async (
    input: SignInSocialBody,
  ): Promise<SignInSocialResponse> => {
    return authFetch<SignInSocialResponse>("/auth/sign-in/social", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  sendVerificationEmail: async (
    input: SendVerificationEmailBody,
  ): Promise<SendVerificationEmailResponse> => {
    return authFetch<SendVerificationEmailResponse>(
      "/auth/send-verification-email",
      {
        method: "POST",
        body: JSON.stringify(input),
      },
    );
  },

  sendVerificationOTP: async (input: {
    email: string;
    type: "email-verification";
    turnstileToken?: string;
  }): Promise<{ success: boolean }> => {
    return authFetch<{ success: boolean }>(
      "/auth/email-otp/send-verification-otp",
      {
        method: "POST",
        body: JSON.stringify(input),
      },
    );
  },

  verifyEmailOTP: async (input: {
    email: string;
    otp: string;
  }): Promise<{
    status: boolean;
    token: string | null;
    user: { id: string; email: string; emailVerified: boolean; name: string };
  }> => {
    return authFetch("/auth/email-otp/verify-email", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  changeEmail: async (input: ChangeEmailBody): Promise<ChangeEmailResponse> => {
    return authFetch<ChangeEmailResponse>("/auth/change-email", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  setPassword: async (input: SetPasswordBody): Promise<SetPasswordResponse> => {
    return authFetch<SetPasswordResponse>("/auth/set-password", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  requestPasswordReset: async (
    input: RequestPasswordResetBody,
  ): Promise<RequestPasswordResetResponse> => {
    return authFetch<RequestPasswordResetResponse>(
      "/auth/request-password-reset",
      {
        method: "POST",
        body: JSON.stringify(input),
      },
    );
  },

  resetPassword: async (
    input: ResetPasswordBody,
  ): Promise<ResetPasswordResponse> => {
    return authFetch<ResetPasswordResponse>("/auth/reset-password", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  listSessions: async () => {
    return authFetch<{ sessions: any[] }>("/auth/list-sessions", {
      method: "POST",
    });
  },

  revokeSession: async (input: { token: string }) => {
    return authFetch<{ success: boolean }>("/auth/revoke-session", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  adminListUsers: async () => {
    return authFetch<{ users: any[] }>("/auth/admin/list-users");
  },

  adminRemoveUser: async (input: { userId: string }) => {
    return authFetch<{ success: boolean }>("/auth/admin/remove-user", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  adminBanUser: async (input: { userId: string; reason?: string }) => {
    return authFetch<{ success: boolean }>("/auth/admin/ban-user", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  adminUnbanUser: async (input: { userId: string }) => {
    return authFetch<{ success: boolean }>("/auth/admin/unban-user", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  adminSetRole: async (input: { userId: string; role: string }) => {
    return authFetch<{ success: boolean }>("/auth/admin/set-role", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  adminEmailTemplates: async () => {
    return authFetch<
      {
        name: string;
        description: string;
        propSchema: Record<
          string,
          { type: string; required: boolean; description: string }
        >;
      }[]
    >("/admin/email/templates");
  },

  adminEmailSendTest: async (input: {
    template: string;
    props: Record<string, unknown>;
    to: string;
  }) => {
    return authFetch<{ success: boolean; to: string }>(
      "/admin/email/send-test",
      {
        method: "POST",
        body: JSON.stringify(input),
      },
    );
  },

  adminEmailSmtpTest: async () => {
    return authFetch<{
      connected: boolean;
      host?: string;
      port?: string;
      error?: string;
    }>("/admin/email/smtp-test", {
      method: "POST",
    });
  },

  confirmIdentity: async (
    input: IdentityConfirmBody,
  ): Promise<IdentityConfirmResponse> => {
    return authFetch<IdentityConfirmResponse>("/auth/identity/confirm", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  checkSlug: async (slug: string): Promise<CheckSlugResponse> => {
    return authFetch<CheckSlugResponse>(
      `/auth/identity/check-slug?slug=${encodeURIComponent(slug)}`,
    );
  },
};
