import type {
  CreatePolicyTagApplicationInput,
  CreatePolicyTagRuleInput,
  PatchPolicyTagApplicationInput,
  UpdatePolicyTagRuleInput,
} from "@rezics/contract";
import { useMutation } from "@tanstack/react-query";
import { policyTagApi } from "./policy-tag.api";
import { policyTagKeys } from "./policy-tag.keys";

// ponytail: root prefix; per-rule granularity if perf matters
// ponytail：根前缀；如需按 rule 精细化再拆
const invalidates = [policyTagKeys.all];

export function useCreatePolicyTagRuleMutation() {
  return useMutation({
    mutationFn: (input: CreatePolicyTagRuleInput) =>
      policyTagApi.createRule(input),
    meta: { invalidates },
  });
}

export function useUpdatePolicyTagRuleMutation(ruleId: string) {
  return useMutation({
    mutationFn: (input: UpdatePolicyTagRuleInput) =>
      policyTagApi.updateRule(ruleId, input),
    meta: { invalidates },
  });
}

export function useUpsertPolicyTagApplicationMutation(ruleId: string) {
  return useMutation({
    mutationFn: (input: CreatePolicyTagApplicationInput) =>
      policyTagApi.upsertApplication(ruleId, input),
    meta: { invalidates },
  });
}

export function usePatchPolicyTagApplicationMutation(input: {
  ruleId: string;
  unitId: string;
}) {
  return useMutation({
    mutationFn: (body: PatchPolicyTagApplicationInput) =>
      policyTagApi.patchApplication(input.ruleId, input.unitId, body),
    meta: { invalidates },
  });
}

export function useDeletePolicyTagApplicationMutation(input: {
  ruleId: string;
  unitId: string;
}) {
  return useMutation({
    mutationFn: () =>
      policyTagApi.deleteApplication(input.ruleId, input.unitId),
    meta: { invalidates },
  });
}
