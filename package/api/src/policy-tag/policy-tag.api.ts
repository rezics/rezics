import type {
  CreatePolicyTagApplicationInput,
  CreatePolicyTagRuleInput,
  PatchPolicyTagApplicationInput,
  PolicyTagApplicationDTO,
  PolicyTagApplicationListQuery,
  PolicyTagApplicationListResponse,
  PolicyTagRuleDTO,
  PolicyTagRuleListQuery,
  PolicyTagRuleListResponse,
  UpdatePolicyTagRuleInput,
} from "@rezics/contract";
import { apiFetch } from "../react-query/http";
import { buildQueryString } from "../utils/buildQuery";

export const policyTagApi = {
  listRules: async (
    query?: PolicyTagRuleListQuery,
  ): Promise<PolicyTagRuleListResponse> => {
    return apiFetch<PolicyTagRuleListResponse>(
      `/policy-tag/rules${buildQueryString(query)}`,
    );
  },

  createRule: async (
    input: CreatePolicyTagRuleInput,
  ): Promise<PolicyTagRuleDTO> => {
    return apiFetch<PolicyTagRuleDTO>("/policy-tag/rules", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  updateRule: async (
    ruleId: string,
    input: UpdatePolicyTagRuleInput,
  ): Promise<PolicyTagRuleDTO> => {
    return apiFetch<PolicyTagRuleDTO>(
      `/policy-tag/rules/${encodeURIComponent(ruleId)}`,
      {
        method: "PATCH",
        body: JSON.stringify(input),
      },
    );
  },

  listApplications: async (
    query?: PolicyTagApplicationListQuery,
  ): Promise<PolicyTagApplicationListResponse> => {
    return apiFetch<PolicyTagApplicationListResponse>(
      `/policy-tag/applications${buildQueryString(query)}`,
    );
  },

  upsertApplication: async (
    ruleId: string,
    input: CreatePolicyTagApplicationInput,
  ): Promise<PolicyTagApplicationDTO> => {
    return apiFetch<PolicyTagApplicationDTO>(
      `/policy-tag/rules/${encodeURIComponent(ruleId)}/applications`,
      {
        method: "POST",
        body: JSON.stringify(input),
      },
    );
  },

  patchApplication: async (
    ruleId: string,
    unitId: string,
    input: PatchPolicyTagApplicationInput,
  ): Promise<PolicyTagApplicationDTO> => {
    return apiFetch<PolicyTagApplicationDTO>(
      `/policy-tag/rules/${encodeURIComponent(
        ruleId,
      )}/applications/${encodeURIComponent(unitId)}`,
      {
        method: "PATCH",
        body: JSON.stringify(input),
      },
    );
  },

  deleteApplication: async (
    ruleId: string,
    unitId: string,
  ): Promise<{ ok: true }> => {
    return apiFetch<{ ok: true }>(
      `/policy-tag/rules/${encodeURIComponent(
        ruleId,
      )}/applications/${encodeURIComponent(unitId)}`,
      { method: "DELETE" },
    );
  },
};
