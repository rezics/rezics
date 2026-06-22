import type {
  CreateUnitFieldLockInput,
  UnitAuthorityRoleKey,
  UnitCollaboratorDTO,
  UnitFieldLockDTO,
} from "@rezics/contract";
import { type UseMutationOptions, useMutation } from "@tanstack/react-query";
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
};

export type RemoveUnitFieldLockVariables = {
  unitId: string;
  path: string;
};

// ponytail: root prefix; per-unit granularity if perf matters
// ponytail：根前缀；如需按 unit 精细化再拆
const invalidates = [unitAuthorityKeys.all];

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
  return useMutation({
    mutationFn: ({ unitId, userId, roleKey }) =>
      unitAuthorityApi.upsertCollaborator(unitId, { userId, roleKey }),
    ...options,
    meta: { invalidates },
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
  return useMutation({
    mutationFn: ({ unitId, userId }) =>
      unitAuthorityApi.removeCollaborator(unitId, userId),
    ...options,
    meta: { invalidates },
  });
}

export function useUpsertUnitFieldLockMutation(
  options?: Omit<
    UseMutationOptions<UnitFieldLockDTO, Error, UpsertUnitFieldLockVariables>,
    "mutationFn"
  >,
) {
  return useMutation({
    mutationFn: ({ unitId, path, reason }) =>
      unitAuthorityApi.upsertFieldLock(unitId, { path, reason }),
    ...options,
    meta: { invalidates },
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
  return useMutation({
    mutationFn: ({ unitId, path }) =>
      unitAuthorityApi.removeFieldLock(unitId, path),
    ...options,
    meta: { invalidates },
  });
}

export const unitAuthorityMutations = {
  useUpsertCollaborator: useUpsertUnitCollaboratorMutation,
  useRemoveCollaborator: useRemoveUnitCollaboratorMutation,
  useUpsertFieldLock: useUpsertUnitFieldLockMutation,
  useRemoveFieldLock: useRemoveUnitFieldLockMutation,
};
