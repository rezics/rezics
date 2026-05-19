import type {
  CreateUnitFieldLockInput,
  LockFieldKey,
  UnitAuthorityRoleKey,
  UnitCollaboratorDTO,
  UnitFieldLockDTO,
} from "@rezics/contract";
import {
  type UseMutationOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { unitAuthorityApi } from "./authority.api";
import { unitAuthorityKeys } from "./authority.keys";

export type UpsertUnitCollaboratorVariables = {
  unitId: string;
  userId: string;
  roleKey: UnitAuthorityRoleKey;
};

export type RemoveUnitCollaboratorVariables = {
  unitId: string;
  userId: string;
};

export type UpsertUnitFieldLockVariables = CreateUnitFieldLockInput & {
  unitId: string;
  fieldKey: LockFieldKey;
};

export type RemoveUnitFieldLockVariables = {
  unitId: string;
  fieldKey: LockFieldKey;
};

export function useUpsertUnitCollaboratorMutation(
  options?: Omit<
    UseMutationOptions<
      UnitCollaboratorDTO,
      Error,
      UpsertUnitCollaboratorVariables
    >,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ unitId, userId, roleKey }) =>
      unitAuthorityApi.upsertCollaborator(unitId, { userId, roleKey }),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      queryClient.invalidateQueries({
        queryKey: unitAuthorityKeys.collaborators(variables.unitId),
      });
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

export function useRemoveUnitCollaboratorMutation(
  options?: Omit<
    UseMutationOptions<
      { message: string },
      Error,
      RemoveUnitCollaboratorVariables
    >,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ unitId, userId }) =>
      unitAuthorityApi.removeCollaborator(unitId, userId),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      queryClient.invalidateQueries({
        queryKey: unitAuthorityKeys.collaborators(variables.unitId),
      });
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

export function useUpsertUnitFieldLockMutation(
  options?: Omit<
    UseMutationOptions<UnitFieldLockDTO, Error, UpsertUnitFieldLockVariables>,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ unitId, fieldKey, reason }) =>
      unitAuthorityApi.upsertFieldLock(unitId, { fieldKey, reason }),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      queryClient.invalidateQueries({
        queryKey: unitAuthorityKeys.fieldLocks(variables.unitId),
      });
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

export function useRemoveUnitFieldLockMutation(
  options?: Omit<
    UseMutationOptions<
      { message: string },
      Error,
      RemoveUnitFieldLockVariables
    >,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ unitId, fieldKey }) =>
      unitAuthorityApi.removeFieldLock(unitId, fieldKey),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      queryClient.invalidateQueries({
        queryKey: unitAuthorityKeys.fieldLocks(variables.unitId),
      });
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

export const unitAuthorityMutations = {
  useUpsertCollaborator: useUpsertUnitCollaboratorMutation,
  useRemoveCollaborator: useRemoveUnitCollaboratorMutation,
  useUpsertFieldLock: useUpsertUnitFieldLockMutation,
  useRemoveFieldLock: useRemoveUnitFieldLockMutation,
};
