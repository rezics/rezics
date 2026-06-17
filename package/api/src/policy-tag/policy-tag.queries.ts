import type {
  PolicyTagApplicationListQuery,
  PolicyTagRuleListQuery,
} from "@rezics/contract";
import { queryOptions } from "@tanstack/react-query";
import { policyTagApi } from "./policy-tag.api";
import { policyTagKeys } from "./policy-tag.keys";

export const policyTagRuleListQuery = (query?: PolicyTagRuleListQuery) =>
  queryOptions({
    queryKey: policyTagKeys.rules(query),
    queryFn: () => policyTagApi.listRules(query),
  });

export const policyTagApplicationListQuery = (
  query?: PolicyTagApplicationListQuery,
) =>
  queryOptions({
    queryKey: policyTagKeys.applications(query),
    queryFn: () => policyTagApi.listApplications(query),
  });
