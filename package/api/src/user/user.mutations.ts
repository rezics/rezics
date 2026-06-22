import type {
  DeleteAccountBody,
  DeleteAccountResult,
  UpdateUser,
  UpdateUserSettings,
  UserDataExport,
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

const userInvalidates = [userKeys.all()];

export function useUpdateMeMutation(
  options?: Omit<UseMutationOptions<UserDTO, Error, UpdateUser>, "mutationFn">,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateUser) => userApi.updateMe(input),
    meta: { invalidates: userInvalidates },
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      qc.setQueryData(userKeys.meDetail(), data);
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

type AdminCreateUserInput = {
  email: string;
  password: string;
  slug: string;
  avatar?: string;
  summary?: string;
};

// MOCK: pairs with userApi.adminCreate; remove the MOCK marker once backend endpoint exists
// MOCK：与 userApi.adminCreate 配对；后端端点就绪后移除 MOCK 标记
export function useAdminCreateUserMutation(
  options?: Omit<
    UseMutationOptions<UserDTO, Error, AdminCreateUserInput>,
    "mutationFn"
  >,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: AdminCreateUserInput) => userApi.adminCreate(input),
    meta: { invalidates: userInvalidates },
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      qc.setQueryData(userKeys.adminDetail(data.unitId), data);
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
    meta: { invalidates: userInvalidates },
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      qc.setQueryData(userKeys.adminDetail(variables.userId), data);
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
    meta: { invalidates: userInvalidates },
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      qc.removeQueries({ queryKey: userKeys.meDetail() });
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

// useFollowMutation / useUnfollowMutation removed by the
// `engagement-subscription` change — the underlying `/user/follow/:id`
// POST/DELETE endpoints are retired. UI consumers go through
// `useSubscribe` / `useUnsubscribe` from `@rezics/api` (subscription
// module) with default `channels=['*']`.
// useFollowMutation / useUnfollowMutation 已被 `engagement-subscription`
// 改动移除——底层的 `/user/follow/:id` POST/DELETE 端点已停用。UI 消费者改用
// `@rezics/api`（subscription 模块）的 `useSubscribe` / `useUnsubscribe`，
// 默认 `channels=['*']`。

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
    meta: { invalidates: userInvalidates },
    onSuccess: (data, variables, onMutateResult, context) => {
      qc.setQueryData(userKeys.emailVerification(), data.state);
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

export function useExportDataMutation(
  options?: Omit<UseMutationOptions<UserDataExport, Error, void>, "mutationFn">,
) {
  return useMutation({
    mutationFn: () => userApi.exportData(),
    ...options,
  });
}

export function useDeleteAccountMutation(
  options?: Omit<
    UseMutationOptions<DeleteAccountResult, Error, DeleteAccountBody>,
    "mutationFn"
  >,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: DeleteAccountBody) => userApi.deleteAccount(input),
    meta: { invalidates: userInvalidates },
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      qc.removeQueries({ queryKey: userKeys.meDetail() });
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

export const userMutations = {
  useUpdateMe: useUpdateMeMutation,
  useAdminCreate: useAdminCreateUserMutation,
  useAdminUpdate: useAdminUpdateUserMutation,
  useDeleteMe: useDeleteMeMutation,
  useUpdateSettings: useUpdateSettingsMutation,
  useRequestEmailVerification: useRequestEmailVerificationMutation,
  useVerifyEmailContract: useVerifyEmailContractMutation,
  useExportData: useExportDataMutation,
  useDeleteAccount: useDeleteAccountMutation,
};
