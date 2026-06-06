import type {
  FederatedSearchOptions,
  FederatedSearchResult,
} from "@rezics/contract";
import { queryOptions, useQuery } from "@tanstack/react-query";
import { apiFetch } from "../react-query/http";

// ANCHOR: Federated search API client
//
// Single entry point that talks to `POST /meili/search/federated`. The
// server returns a `FederatedSearchResult` discriminated on `kind`
// (`"grouped" | "ranked" | "single"`), which consumers narrow with
// `if (data.kind === "grouped") ...`.

export const meiliFederatedApi = {
  federatedSearch: async (
    opts: FederatedSearchOptions,
  ): Promise<FederatedSearchResult> => {
    return apiFetch<FederatedSearchResult>(`/meili/search/federated`, {
      method: "POST",
      body: JSON.stringify(opts),
    });
  },
};

// ANCHOR: TanStack Query options + hook

const FEDERATED_STALE_MS = 1000 * 60 * 2;
const FEDERATED_GC_MS = 1000 * 60 * 5;

export const federatedSearchQueryOptions = (opts: FederatedSearchOptions) =>
  queryOptions({
    queryKey: ["federated-search", opts],
    queryFn: () => meiliFederatedApi.federatedSearch(opts),
    staleTime: FEDERATED_STALE_MS,
    gcTime: FEDERATED_GC_MS,
  });

export function useFederatedSearch(opts: FederatedSearchOptions) {
  return useQuery(federatedSearchQueryOptions(opts));
}
