import type { UpdateUser, UpdateUserSettings, UserDTO, UserSettings } from "@rezics/contract";
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

export function useAdminUpdateUserMutation(
  options?: Omit<
    UseMutationOptions<UserDTO, Error, { unitId: string; input: UpdateUser }>,
    "mutationFn"
  >,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ unitId, input }) =>
      userApi.adminUpdate(unitId, input as any),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      qc.setQueryData(userKeys.adminDetail(variables.unitId), data);
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

export const userMutations = {
  useUpdateMe: useUpdateMeMutation,
  useAdminUpdate: useAdminUpdateUserMutation,
  useDeleteMe: useDeleteMeMutation,
  useFollow: useFollowMutation,
  useUnfollow: useUnfollowMutation,
  useUpdateSettings: useUpdateSettingsMutation,
};
