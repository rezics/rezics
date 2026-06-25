import type {
  AccountMaterializationResponse,
  AccountSetupBody,
  AccountSetupResponse,
  AuthResponse,
  ChangeEmailBody,
  ChangeEmailResponse,
  RequestPasswordResetBody,
  RequestPasswordResetResponse,
  ResetPasswordBody,
  ResetPasswordResponse,
  SendVerificationEmailBody,
  SendVerificationEmailResponse,
  SendVerificationOtpBody,
  SendVerificationOtpResponse,
  SetPasswordBody,
  SetPasswordResponse,
  SignInBody,
  SignInSocialBody,
  SignInSocialResponse,
  SignOutResponse,
  SignUpBody,
  VerifyEmailOtpBody,
  VerifyEmailOtpResponse,
} from "@rezics/contract";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { clearAuthPresence } from "../react-query/authPresence";
import { queryAccessToken } from "../react-query/jwt";
import { authApi } from "./auth.api";
import { authKeys } from "./auth.keys";

export const signIn = (input: SignInBody): Promise<AuthResponse> =>
  authApi.signIn(input);

export const signUp = (
  input: Pick<SignUpBody, "email" | "password">,
): Promise<AuthResponse> => authApi.signUp(input);

export const signOut = (): Promise<SignOutResponse> => authApi.signOut();

export const signInSocial = (
  input: SignInSocialBody,
): Promise<SignInSocialResponse> => authApi.signInSocial(input);

export const requestPasswordReset = (
  input: RequestPasswordResetBody,
): Promise<RequestPasswordResetResponse> =>
  authApi.requestPasswordReset(input);

export const sendVerificationEmail = (
  input: SendVerificationEmailBody,
): Promise<SendVerificationEmailResponse> =>
  authApi.sendVerificationEmail(input);

export const changeEmail = (
  input: ChangeEmailBody,
): Promise<ChangeEmailResponse> => authApi.changeEmail(input);

export const setPassword = (
  input: SetPasswordBody,
): Promise<SetPasswordResponse> => authApi.setPassword(input);

export const resetPassword = (
  input: ResetPasswordBody,
): Promise<ResetPasswordResponse> => authApi.resetPassword(input);

export const sendVerificationOTP = (
  input: SendVerificationOtpBody,
): Promise<SendVerificationOtpResponse> => authApi.sendVerificationOTP(input);

export const verifyEmailOTP = (
  input: VerifyEmailOtpBody,
): Promise<VerifyEmailOtpResponse> => authApi.verifyEmailOTP(input);

export const setupProfile = (
  input: AccountSetupBody,
): Promise<AccountSetupResponse> => authApi.setupProfile(input);

export const materializeAccount =
  (): Promise<AccountMaterializationResponse> => authApi.materializeAccount();

export const revokeSession = (
  input: { token: string },
): Promise<{ success: boolean }> => authApi.revokeSession(input);

export function useSignInMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: signIn,
    onSuccess: async () => {
      qc.invalidateQueries({ queryKey: authKeys.session() });
      qc.invalidateQueries({ queryKey: authKeys.sessionState() });
    },
  });
}

export function useSignOutMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: signOut,
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
    mutationFn: signUp,
    onSuccess: async () => {
      qc.invalidateQueries({ queryKey: authKeys.session() });
      qc.invalidateQueries({ queryKey: authKeys.sessionState() });
      await queryAccessToken({ requirePresence: false });
    },
  });
}

export function useSignInSocialMutation() {
  return useMutation({
    mutationFn: signInSocial,
  });
}

export function useRequestPasswordResetMutation() {
  return useMutation({
    mutationFn: requestPasswordReset,
  });
}

export function useResetPasswordMutation() {
  return useMutation({
    mutationFn: resetPassword,
  });
}

export function useSendVerificationEmailMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: sendVerificationEmail,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: authKeys.sessionState() });
    },
  });
}

export function useChangeEmailMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: changeEmail,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: authKeys.session() });
      qc.invalidateQueries({ queryKey: authKeys.sessionState() });
    },
  });
}

export function useSetPasswordMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: setPassword,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: authKeys.sessionState() });
    },
  });
}

export function useRevokeSessionMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: revokeSession,
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
    }) => sendVerificationOTP(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: authKeys.sessionState() });
    },
  });
}

export function useVerifyEmailOTPMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: verifyEmailOTP,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: authKeys.sessionState() });
    },
  });
}

export function useSetupAccountMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: setupProfile,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: authKeys.session() });
      qc.invalidateQueries({ queryKey: authKeys.sessionState() });
    },
  });
}

export function useMaterializeAccountMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: materializeAccount,
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
  useSignInSocial: useSignInSocialMutation,
  useRequestPasswordReset: useRequestPasswordResetMutation,
  useResetPassword: useResetPasswordMutation,
  useSendVerificationEmail: useSendVerificationEmailMutation,
  useChangeEmail: useChangeEmailMutation,
  useSetPassword: useSetPasswordMutation,
  useRevokeSession: useRevokeSessionMutation,
  useSendVerificationOTP: useSendVerificationOTPMutation,
  useVerifyEmailOTP: useVerifyEmailOTPMutation,
  useSetupAccount: useSetupAccountMutation,
  useMaterializeAccount: useMaterializeAccountMutation,
};
