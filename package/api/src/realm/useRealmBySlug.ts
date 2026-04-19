import type { RealmDTO } from "@rezics/contract";
import { queryOptions, useQuery } from "@tanstack/react-query";
import { apiFetch } from "../react-query/http";
import { realmKeys } from "./realm.keys";

export const realmBySlugKeys = {
  bySlug: (slug: string) => [...realmKeys.all(), "by-slug", slug] as const,
};

export function realmBySlugQuery(slug: string) {
  return queryOptions({
    queryKey: realmBySlugKeys.bySlug(slug),
    queryFn: () => apiFetch<RealmDTO>(`/realm/by-slug/${encodeURIComponent(slug)}`),
    enabled: !!slug,
    staleTime: 1000 * 60 * 10,
  });
}

export function useRealmBySlug(slug: string) {
  return useQuery(realmBySlugQuery(slug));
}
