import { useMutation } from "@tanstack/react-query";
import { clearAuthPresence } from "../react-query/authPresence";
import { queryAccessToken } from "../react-query/jwt";
import { authApi } from "./auth.api";
import { authKeys } from "./auth.keys";

// Shared invalidation key sets — each mutation picks the narrowest group that
// covers its write scope. Declared once so mutations stay DRY.
// 共享的失效 key 集——每个 mutation 选取恰好覆盖其写范围的最窄组。声明一次
// 以保持 mutation 不重复。
const invalidatesIdentity = [authKeys.session(), authKeys.sessionState()];
const invalidatesSessionState = [authKeys.sessionState()];
const invalidatesAdminUsers = [authKeys.adminUsers()];
const invalidatesSessions = [authKeys.sessions()];

// Sign-out touches identity + sessions list; `authKeys.all()` is the right
// breadth since every auth query may be stale after logout.
// ponytail: broadened to authKeys.all() — sign-out invalidates everything auth
// 退出登录影响身份 + 会话列表；`authKeys.all()` 是正确粒度，因为登出后所有
// auth 查询都可能过期。
const invalidatesSignOut = [authKeys.all()];

export function useSignInMutation() {
  return useMutation({
    mutationFn: (input: { email: string; password: string }) =>
      authApi.signIn(input),
    meta: { invalidates: invalidatesIdentity },
  });
}

export function useSignOutMutation() {
  return useMutation({
    mutationFn: () => authApi.signOut(),
    onSuccess: () => {
      clearAuthPresence();
    },
    meta: { invalidates: invalidatesSignOut },
  });
}

export function useSignUpMutation() {
  return useMutation({
    mutationFn: (input: { email: string; password: string }) =>
      authApi.signUp(input),
    onSuccess: async () => {
      await queryAccessToken({ requirePresence: false });
    },
    meta: { invalidates: invalidatesIdentity },
  });
}

export function useSendVerificationEmailMutation() {
  return useMutation({
    mutationFn: (input: { email: string; callbackURL?: string }) =>
      authApi.sendVerificationEmail(input),
    meta: { invalidates: invalidatesSessionState },
  });
}

export function useChangeEmailMutation() {
  return useMutation({
    mutationFn: (input: { newEmail: string; callbackURL?: string }) =>
      authApi.changeEmail(input),
    meta: { invalidates: invalidatesIdentity },
  });
}

export function useSetPasswordMutation() {
  return useMutation({
    mutationFn: (input: { newPassword: string }) => authApi.setPassword(input),
    meta: { invalidates: invalidatesSessionState },
  });
}

export function useAdminBanUserMutation() {
  return useMutation({
    mutationFn: (input: { userId: string; reason?: string }) =>
      authApi.adminBanUser(input),
    meta: { invalidates: invalidatesAdminUsers },
  });
}

export function useAdminUnbanUserMutation() {
  return useMutation({
    mutationFn: (input: { userId: string }) => authApi.adminUnbanUser(input),
    meta: { invalidates: invalidatesAdminUsers },
  });
}

export function useAdminSetRoleMutation() {
  return useMutation({
    mutationFn: (input: { userId: string; role: string }) =>
      authApi.adminSetRole(input),
    meta: { invalidates: invalidatesAdminUsers },
  });
}

export function useAdminRemoveUserMutation() {
  return useMutation({
    mutationFn: (input: { userId: string }) => authApi.adminRemoveUser(input),
    meta: { invalidates: invalidatesAdminUsers },
  });
}

export function useRevokeSessionMutation() {
  return useMutation({
    mutationFn: (input: { token: string }) => authApi.revokeSession(input),
    meta: { invalidates: invalidatesSessions },
  });
}

export function useSendVerificationOTPMutation() {
  return useMutation({
    mutationFn: (input: {
      email: string;
      type: "email-verification";
      turnstileToken?: string;
    }) => authApi.sendVerificationOTP(input),
    meta: { invalidates: invalidatesSessionState },
  });
}

export function useVerifyEmailOTPMutation() {
  return useMutation({
    mutationFn: (input: { email: string; otp: string }) =>
      authApi.verifyEmailOTP(input),
    meta: { invalidates: invalidatesSessionState },
  });
}

export function useSetupAccountMutation() {
  return useMutation({
    mutationFn: (input: { displayName: string; slug: string }) =>
      authApi.setupProfile(input),
    meta: { invalidates: invalidatesIdentity },
  });
}

export const authMutations = {
  useSignIn: useSignInMutation,
  useSignUp: useSignUpMutation,
  useSignOut: useSignOutMutation,
  useSendVerificationEmail: useSendVerificationEmailMutation,
  useChangeEmail: useChangeEmailMutation,
  useSetPassword: useSetPasswordMutation,
  useAdminBanUser: useAdminBanUserMutation,
  useAdminUnbanUser: useAdminUnbanUserMutation,
  useAdminSetRole: useAdminSetRoleMutation,
  useAdminRemoveUser: useAdminRemoveUserMutation,
  useRevokeSession: useRevokeSessionMutation,
  useSendVerificationOTP: useSendVerificationOTPMutation,
  useVerifyEmailOTP: useVerifyEmailOTPMutation,
  useSetupAccount: useSetupAccountMutation,
};
