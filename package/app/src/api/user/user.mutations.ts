import {
  useMutation,
  useQueryClient,
  type UseMutationOptions,
} from '@tanstack/react-query';
import {userApi} from './user.api';
import {userKeys} from './user.keys';
import type {
  CreateUserInput,
  UpdateUserInput,
  UserDTO,
} from '@package/contract';

export function useRegisterMutation(
  options?: Omit<
    UseMutationOptions<{user: UserDTO; token: string}, Error, CreateUserInput>,
    'mutationFn'
  >,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateUserInput) => userApi.register(input),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      // Seed current user
      qc.setQueryData(userKeys.detail('me'), data.user);
      qc.invalidateQueries({queryKey: userKeys.lists()});
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

export function useLoginMutation(
  options?: Omit<
    UseMutationOptions<
      {user: UserDTO; token: string},
      Error,
      {email: string; password: string}
    >,
    'mutationFn'
  >,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {email: string; password: string}) =>
      userApi.login(input),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      qc.setQueryData(userKeys.detail('me'), data.user);
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

export function useUpdateMeMutation(
  options?: Omit<
    UseMutationOptions<UserDTO, Error, UpdateUserInput>,
    'mutationFn'
  >,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateUserInput) => userApi.updateMe(input),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      qc.setQueryData(userKeys.detail('me'), data);
      qc.invalidateQueries({queryKey: userKeys.lists()});
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

export function useDeleteMeMutation(
  options?: Omit<
    UseMutationOptions<{message: string}, Error, void>,
    'mutationFn'
  >,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => userApi.deleteMe(),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      qc.removeQueries({queryKey: userKeys.detail('me')});
      qc.invalidateQueries({queryKey: userKeys.lists()});
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

export function useFollowMutation(
  options?: Omit<
    UseMutationOptions<{message: string}, Error, string>,
    'mutationFn'
  >,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (targetId: string) => userApi.follow(targetId),
    ...options,
    onSuccess: (data, targetId, onMutateResult, context) => {
      qc.invalidateQueries({queryKey: userKeys.detail(targetId)});
      qc.invalidateQueries({queryKey: userKeys.detail('me')});
      // Invalidate specific follow status
      qc.invalidateQueries({
        predicate: query => {
          const key = query.queryKey;
          return (
            key[0] === 'users' &&
            key[1] === 'detail' &&
            key[2] === 'me' &&
            key[3] === 'follow-status' &&
            Array.isArray(key[4]) &&
            key[4].includes(targetId)
          );
        },
      });
      qc.invalidateQueries({queryKey: userKeys.followers(targetId)});
      options?.onSuccess?.(data, targetId, onMutateResult, context);
    },
  });
}

export function useUnfollowMutation(
  options?: Omit<
    UseMutationOptions<{message: string}, Error, string>,
    'mutationFn'
  >,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (targetId: string) => userApi.unfollow(targetId),
    ...options,
    onSuccess: (data, targetId, onMutateResult, context) => {
      qc.invalidateQueries({queryKey: userKeys.detail(targetId)});
      qc.invalidateQueries({queryKey: userKeys.detail('me')});
      // Invalidate specific follow status
      qc.invalidateQueries({
        predicate: query => {
          const key = query.queryKey;
          return (
            key[0] === 'users' &&
            key[1] === 'detail' &&
            key[2] === 'me' &&
            key[3] === 'follow-status' &&
            Array.isArray(key[4]) &&
            key[4].includes(targetId)
          );
        },
      });
      qc.invalidateQueries({queryKey: userKeys.followers(targetId)});
      options?.onSuccess?.(data, targetId, onMutateResult, context);
    },
  });
}

export const userMutations = {
  useRegister: useRegisterMutation,
  useLogin: useLoginMutation,
  useUpdateMe: useUpdateMeMutation,
  useDeleteMe: useDeleteMeMutation,
  useFollow: useFollowMutation,
  useUnfollow: useUnfollowMutation,
};
