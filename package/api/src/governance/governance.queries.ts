import { queryOptions } from "@tanstack/react-query";
import { governanceApi } from "./governance.api";
import { governanceKeys } from "./governance.keys";

export const governanceCapabilityHintsQuery = () =>
  queryOptions({
    queryKey: governanceKeys.capabilityHints(),
    queryFn: () => governanceApi.capabilityHints(),
    staleTime: 1000 * 60,
  });

export const governanceQueries = {
  capabilityHints: governanceCapabilityHintsQuery,
};
