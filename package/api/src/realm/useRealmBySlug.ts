import type { RealmDTO } from "@rezics/contract";
import { queryOptions, useQuery } from "@tanstack/react-query";
import { apiFetch } from "../react-query/http";
import { realmKeys } from "./realm.keys";

export const realmBySlugKeys = {
  bySlug: (realmSlug: string) =>
    [...realmKeys.all(), "by-slug", realmSlug] as const,
};

export function realmBySlugQuery(realmSlug: string) {
  return queryOptions({
    queryKey: realmBySlugKeys.bySlug(realmSlug),
    queryFn: () =>
      apiFetch<RealmDTO>(`/realm/by-slug/${encodeURIComponent(realmSlug)}`),
    enabled: !!realmSlug,
    staleTime: 1000 * 60 * 10,
  });
}

export function useRealmBySlug(realmSlug: string) {
  return useQuery(realmBySlugQuery(realmSlug));
}
