import type {
  LinkSubjectAttributionInput,
  SubjectAttributionDTO,
} from "@rezics/contract";
import {
  type UseMutationOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { subjectAttributionApi } from "./subject-attribution.api";
import { subjectAttributionKeys } from "./subject-attribution.keys";

export function useLinkSubjectAttributionMutation(
  options?: Omit<
    UseMutationOptions<
      SubjectAttributionDTO,
      Error,
      LinkSubjectAttributionInput
    >,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: LinkSubjectAttributionInput) =>
      subjectAttributionApi.link(input),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      queryClient.invalidateQueries({
        queryKey: subjectAttributionKeys.byUnit(variables.unitId),
      });
      queryClient.invalidateQueries({
        queryKey: subjectAttributionKeys.bySubject(variables.entityId),
      });
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

export function useUnlinkSubjectAttributionMutation(
  options?: Omit<
    UseMutationOptions<
      { message: string },
      Error,
      { unitId: string; entityId: string; role: string }
    >,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ unitId, entityId, role }) =>
      subjectAttributionApi.unlink(unitId, entityId, role),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      queryClient.invalidateQueries({
        queryKey: subjectAttributionKeys.byUnit(variables.unitId),
      });
      queryClient.invalidateQueries({
        queryKey: subjectAttributionKeys.bySubject(variables.entityId),
      });
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

export const subjectAttributionMutations = {
  useLink: useLinkSubjectAttributionMutation,
  useUnlink: useUnlinkSubjectAttributionMutation,
};
