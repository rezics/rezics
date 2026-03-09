import {useMutation, useQueryClient} from '@tanstack/react-query';
import {authApi} from './auth.api';
import {authKeys} from './auth.keys';
import {setToken, queryAccessToken} from '../react-query/jwt';

export function useSignInMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {email: string; password: string}) =>
      authApi.signIn(input),
    onSuccess: async () => {
      qc.invalidateQueries({queryKey: authKeys.session()});
      await queryAccessToken();
    },
  });
}

export function useSignOutMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => authApi.signOut(),
    onSuccess: () => {
      qc.invalidateQueries({queryKey: authKeys.session()});
      qc.invalidateQueries({queryKey: authKeys.sessions()});
    },
  });
}

export function useAdminBanUserMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {userId: string; reason?: string}) =>
      authApi.adminBanUser(input),
    onSuccess: () => {
      qc.invalidateQueries({queryKey: authKeys.adminUsers()});
    },
  });
}

export function useAdminUnbanUserMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {userId: string}) => authApi.adminUnbanUser(input),
    onSuccess: () => {
      qc.invalidateQueries({queryKey: authKeys.adminUsers()});
    },
  });
}

export function useAdminSetRoleMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {userId: string; role: string}) =>
      authApi.adminSetRole(input),
    onSuccess: () => {
      qc.invalidateQueries({queryKey: authKeys.adminUsers()});
    },
  });
}

export function useAdminRemoveUserMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {userId: string}) => authApi.adminRemoveUser(input),
    onSuccess: () => {
      qc.invalidateQueries({queryKey: authKeys.adminUsers()});
    },
  });
}

export function useRevokeSessionMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {token: string}) => authApi.revokeSession(input),
    onSuccess: () => {
      qc.invalidateQueries({queryKey: authKeys.sessions()});
    },
  });
}

export const authMutations = {
  useSignIn: useSignInMutation,
  useSignOut: useSignOutMutation,
  useAdminBanUser: useAdminBanUserMutation,
  useAdminUnbanUser: useAdminUnbanUserMutation,
  useAdminSetRole: useAdminSetRoleMutation,
  useAdminRemoveUser: useAdminRemoveUserMutation,
  useRevokeSession: useRevokeSessionMutation,
};
