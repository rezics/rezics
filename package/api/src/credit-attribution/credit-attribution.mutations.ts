import type {
  CreateCreditAttributionEvidenceInput,
  CreditAttributionDTO,
  CreditAttributionRole,
  LinkCreditAttributionInput,
} from "@rezics/contract";
import { type UseMutationOptions, useMutation } from "@tanstack/react-query";
import { bookKeys } from "../book/book.keys";
import { entityKeys } from "../entity/entity.keys";
import { creditAttributionApi } from "./credit-attribution.api";
import { creditAttributionKeys } from "./credit-attribution.keys";

const invalidates = [
  creditAttributionKeys.all(),
  bookKeys.all(),
  entityKeys.all(),
];

export function useLinkCreditAttributionMutation(
  options?: Omit<
    UseMutationOptions<CreditAttributionDTO, Error, LinkCreditAttributionInput>,
    "mutationFn"
  >,
) {
  return useMutation({
    mutationFn: (input: LinkCreditAttributionInput) =>
      creditAttributionApi.link(input),
    ...options,
    meta: { invalidates },
  });
}

export function useUnlinkCreditAttributionMutation(
  options?: Omit<
    UseMutationOptions<
      { message: string },
      Error,
      { unitId: string; entityId: string; role: CreditAttributionRole }
    >,
    "mutationFn"
  >,
) {
  return useMutation({
    mutationFn: ({ unitId, entityId, role }) =>
      creditAttributionApi.unlink(unitId, entityId, role),
    ...options,
    meta: { invalidates },
  });
}

export function useCreateCreditAttributionEvidenceMutation(
  options?: Omit<
    UseMutationOptions<
      CreditAttributionDTO,
      Error,
      CreateCreditAttributionEvidenceInput
    >,
    "mutationFn"
  >,
) {
  return useMutation({
    mutationFn: (input: CreateCreditAttributionEvidenceInput) =>
      creditAttributionApi.createEvidence(input),
    ...options,
    meta: { invalidates },
  });
}

export const creditAttributionMutations = {
  useLink: useLinkCreditAttributionMutation,
  useUnlink: useUnlinkCreditAttributionMutation,
  useCreateEvidence: useCreateCreditAttributionEvidenceMutation,
};
