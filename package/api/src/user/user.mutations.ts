import type {
  UpdateUser,
  UpdateUserSettings,
  UserDTO,
  UserEmailVerificationConfirmBody,
  UserEmailVerificationRequestBody,
  UserEmailVerificationResponse,
  UserSettings,
} from "@rezics/contract";
import {
  type UseMutationOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { userApi } from "./user.api";
import { userKeys } from "./user.keys";

export function useUpdateMeMutation(
  options?: Omit<UseMutationOptions<UserDTO, Error, UpdateUser>, "mutationFn">,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateUser) => userApi.updateMe(input),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      qc.setQueryData(userKeys.detail("me"), data);
      qc.invalidateQueries({ queryKey: userKeys.lists() });
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

type AdminCreateUserInput = {
  email: string;
  password: string;
  slug: string;
  avatar?: string;
  bio?: string;
};

// MOCK: pairs with userApi.adminCreate; remove the MOCK marker once backend endpoint exists
export function useAdminCreateUserMutation(
  options?: Omit<
    UseMutationOptions<UserDTO, Error, AdminCreateUserInput>,
    "mutationFn"
  >,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: AdminCreateUserInput) => userApi.adminCreate(input),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      qc.setQueryData(userKeys.adminDetail(data.unitId), data);
      qc.invalidateQueries({ queryKey: userKeys.adminLists() });
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

export function useAdminUpdateUserMutation(
  options?: Omit<
    UseMutationOptions<UserDTO, Error, { userId: string; input: UpdateUser }>,
    "mutationFn"
  >,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, input }) =>
      userApi.adminUpdate(userId, input as any),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      qc.setQueryData(userKeys.adminDetail(variables.userId), data);
      qc.invalidateQueries({ queryKey: userKeys.adminLists() });
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

export function useDeleteMeMutation(
  options?: Omit<
    UseMutationOptions<{ message: string }, Error, void>,
    "mutationFn"
  >,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => userApi.deleteMe(),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      qc.removeQueries({ queryKey: userKeys.detail("me") });
      qc.invalidateQueries({ queryKey: userKeys.lists() });
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

export function useFollowMutation(
  options?: Omit<
    UseMutationOptions<{ message: string }, Error, string>,
    "mutationFn"
  >,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (targetId: string) => userApi.follow(targetId),
    ...options,
    onSuccess: (data, targetId, onMutateResult, context) => {
      qc.invalidateQueries({ queryKey: userKeys.detail(targetId) });
      qc.invalidateQueries({ queryKey: userKeys.detail("me") });
      // Invalidate specific follow status
      qc.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey;
          return (
            key[0] === "users" &&
            key[1] === "detail" &&
            key[2] === "me" &&
            key[3] === "follow-status" &&
            Array.isArray(key[4]) &&
            key[4].includes(targetId)
          );
        },
      });
      qc.invalidateQueries({ queryKey: userKeys.followers(targetId) });
      options?.onSuccess?.(data, targetId, onMutateResult, context);
    },
  });
}

export function useUnfollowMutation(
  options?: Omit<
    UseMutationOptions<{ message: string }, Error, string>,
    "mutationFn"
  >,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (targetId: string) => userApi.unfollow(targetId),
    ...options,
    onSuccess: (data, targetId, onMutateResult, context) => {
      qc.invalidateQueries({ queryKey: userKeys.detail(targetId) });
      qc.invalidateQueries({ queryKey: userKeys.detail("me") });
      // Invalidate specific follow status
      qc.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey;
          return (
            key[0] === "users" &&
            key[1] === "detail" &&
            key[2] === "me" &&
            key[3] === "follow-status" &&
            Array.isArray(key[4]) &&
            key[4].includes(targetId)
          );
        },
      });
      qc.invalidateQueries({ queryKey: userKeys.followers(targetId) });
      options?.onSuccess?.(data, targetId, onMutateResult, context);
    },
  });
}

export function useUpdateSettingsMutation(
  options?: Omit<
    UseMutationOptions<UserSettings, Error, UpdateUserSettings>,
    "mutationFn"
  >,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateUserSettings) => userApi.updateSettings(input),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      qc.setQueryData(userKeys.settings(), data);
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

export function useRequestEmailVerificationMutation(
  options?: Omit<
    UseMutationOptions<
      UserEmailVerificationResponse,
      Error,
      UserEmailVerificationRequestBody
    >,
    "mutationFn"
  >,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UserEmailVerificationRequestBody) =>
      userApi.requestEmailVerification(input),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      qc.setQueryData(userKeys.emailVerification(), data.state);
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

export function useVerifyEmailContractMutation(
  options?: Omit<
    UseMutationOptions<
      UserEmailVerificationResponse,
      Error,
      UserEmailVerificationConfirmBody
    >,
    "mutationFn"
  >,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UserEmailVerificationConfirmBody) =>
      userApi.verifyEmailContract(input),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      qc.setQueryData(userKeys.emailVerification(), data.state);
      qc.invalidateQueries({ queryKey: userKeys.meDetail() });
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

export const userMutations = {
  useUpdateMe: useUpdateMeMutation,
  useAdminCreate: useAdminCreateUserMutation,
  useAdminUpdate: useAdminUpdateUserMutation,
  useDeleteMe: useDeleteMeMutation,
  useFollow: useFollowMutation,
  useUnfollow: useUnfollowMutation,
  useUpdateSettings: useUpdateSettingsMutation,
  useRequestEmailVerification: useRequestEmailVerificationMutation,
  useVerifyEmailContract: useVerifyEmailContractMutation,
};
