import type {
  LinkSubjectAttributionInput,
  SubjectAttributionDTO,
  SubjectAttributionRole,
} from "@rezics/contract";
import { type UseMutationOptions, useMutation } from "@tanstack/react-query";
import { entityKeys } from "../entity/entity.keys";
import { subjectAttributionApi } from "./subject-attribution.api";
import { subjectAttributionKeys } from "./subject-attribution.keys";

const invalidates = [subjectAttributionKeys.all(), entityKeys.all()];

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
  return useMutation({
    mutationFn: (input: LinkSubjectAttributionInput) =>
      subjectAttributionApi.link(input),
    ...options,
    meta: { invalidates },
  });
}

export function useUnlinkSubjectAttributionMutation(
  options?: Omit<
    UseMutationOptions<
      { message: string },
      Error,
      { unitId: string; entityId: string; role: SubjectAttributionRole }
    >,
    "mutationFn"
  >,
) {
  return useMutation({
    mutationFn: ({ unitId, entityId, role }) =>
      subjectAttributionApi.unlink(unitId, entityId, role),
    ...options,
    meta: { invalidates },
  });
}

export const subjectAttributionMutations = {
  useLink: useLinkSubjectAttributionMutation,
  useUnlink: useUnlinkSubjectAttributionMutation,
};
