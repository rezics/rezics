import type { UnitTagDTO } from "@rezics/contract";
import { queryOptions, useQuery } from "@tanstack/react-query";
import { apiFetch } from "../react-query/http";
import { tagKeys } from "./tag.keys";

export const tagBySlugKeys = {
  bySlug: (slug: string) => [...tagKeys.all(), "by-slug", slug] as const,
};

export function tagBySlugQuery(slug: string) {
  return queryOptions({
    queryKey: tagBySlugKeys.bySlug(slug),
    queryFn: () => apiFetch<UnitTagDTO>(`/tag/by-slug/${encodeURIComponent(slug)}`),
    enabled: !!slug,
    staleTime: 1000 * 60 * 10,
  });
}

export function useTagBySlug(slug: string) {
  return useQuery(tagBySlugQuery(slug));
}
