import type {
  CreatePolicyTagApplicationInput,
  CreatePolicyTagRuleInput,
  PatchPolicyTagApplicationInput,
  UpdatePolicyTagRuleInput,
} from "@rezics/contract";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { policyTagApi } from "./policy-tag.api";
import { policyTagKeys } from "./policy-tag.keys";

function invalidatePolicyTags(queryClient: ReturnType<typeof useQueryClient>) {
  return queryClient.invalidateQueries({ queryKey: policyTagKeys.all });
}

export function useCreatePolicyTagRuleMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreatePolicyTagRuleInput) =>
      policyTagApi.createRule(input),
    onSuccess: () => invalidatePolicyTags(queryClient),
  });
}

export function useUpdatePolicyTagRuleMutation(ruleId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdatePolicyTagRuleInput) =>
      policyTagApi.updateRule(ruleId, input),
    onSuccess: () => invalidatePolicyTags(queryClient),
  });
}

export function useUpsertPolicyTagApplicationMutation(ruleId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreatePolicyTagApplicationInput) =>
      policyTagApi.upsertApplication(ruleId, input),
    onSuccess: () => invalidatePolicyTags(queryClient),
  });
}

export function usePatchPolicyTagApplicationMutation(input: {
  ruleId: string;
  unitId: string;
}) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: PatchPolicyTagApplicationInput) =>
      policyTagApi.patchApplication(input.ruleId, input.unitId, body),
    onSuccess: () => invalidatePolicyTags(queryClient),
  });
}

export function useDeletePolicyTagApplicationMutation(input: {
  ruleId: string;
  unitId: string;
}) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      policyTagApi.deleteApplication(input.ruleId, input.unitId),
    onSuccess: () => invalidatePolicyTags(queryClient),
  });
}
