import { useMutation, useQueryClient } from "@tanstack/react-query";
import { clearAuthPresence } from "../react-query/authPresence";
import { queryAccessToken } from "../react-query/jwt";
import { authApi } from "./auth.api";
import { authKeys } from "./auth.keys";

export function useSignInMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { email: string; password: string }) =>
      authApi.signIn(input),
    onSuccess: async () => {
      qc.invalidateQueries({ queryKey: authKeys.session() });
      qc.invalidateQueries({ queryKey: authKeys.sessionState() });
    },
  });
}

export function useSignOutMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => authApi.signOut(),
    onSuccess: () => {
      clearAuthPresence();
      qc.invalidateQueries({ queryKey: authKeys.session() });
      qc.invalidateQueries({ queryKey: authKeys.sessionState() });
      qc.invalidateQueries({ queryKey: authKeys.sessions() });
    },
  });
}

export function useSignUpMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { email: string; password: string }) =>
      authApi.signUp(input),
    onSuccess: async () => {
      qc.invalidateQueries({ queryKey: authKeys.session() });
      qc.invalidateQueries({ queryKey: authKeys.sessionState() });
      await queryAccessToken({ requirePresence: false });
    },
  });
}

export function useSendVerificationEmailMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { email: string; callbackURL?: string }) =>
      authApi.sendVerificationEmail(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: authKeys.sessionState() });
    },
  });
}

export function useChangeEmailMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { newEmail: string; callbackURL?: string }) =>
      authApi.changeEmail(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: authKeys.session() });
      qc.invalidateQueries({ queryKey: authKeys.sessionState() });
    },
  });
}

export function useSetPasswordMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { newPassword: string }) => authApi.setPassword(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: authKeys.sessionState() });
    },
  });
}

export function useRevokeSessionMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { token: string }) => authApi.revokeSession(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: authKeys.sessions() });
    },
  });
}

export function useSendVerificationOTPMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      email: string;
      type: "email-verification";
      turnstileToken?: string;
    }) => authApi.sendVerificationOTP(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: authKeys.sessionState() });
    },
  });
}

export function useVerifyEmailOTPMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { email: string; otp: string }) =>
      authApi.verifyEmailOTP(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: authKeys.sessionState() });
    },
  });
}

export function useSetupAccountMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { displayName: string; slug: string }) =>
      authApi.setupProfile(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: authKeys.session() });
      qc.invalidateQueries({ queryKey: authKeys.sessionState() });
    },
  });
}

export const authMutations = {
  useSignIn: useSignInMutation,
  useSignUp: useSignUpMutation,
  useSignOut: useSignOutMutation,
  useSendVerificationEmail: useSendVerificationEmailMutation,
  useChangeEmail: useChangeEmailMutation,
  useSetPassword: useSetPasswordMutation,
  useRevokeSession: useRevokeSessionMutation,
  useSendVerificationOTP: useSendVerificationOTPMutation,
  useVerifyEmailOTP: useVerifyEmailOTPMutation,
  useSetupAccount: useSetupAccountMutation,
};
