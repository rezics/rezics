import type {
  PolicyTagApplicationListQuery,
  PolicyTagRuleListQuery,
} from "@rezics/contract";

export const policyTagKeys = {
  all: ["policy-tag"] as const,
  rules: (query?: PolicyTagRuleListQuery) =>
    [...policyTagKeys.all, "rules", query ?? {}] as const,
  applications: (query?: PolicyTagApplicationListQuery) =>
    [...policyTagKeys.all, "applications", query ?? {}] as const,
};
