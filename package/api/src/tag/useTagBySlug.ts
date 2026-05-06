import type { UnitTagDTO } from "@rezics/contract";
import { queryOptions, useQuery } from "@tanstack/react-query";
import { apiFetch } from "../react-query/http";
import { tagKeys } from "./tag.keys";

export const tagBySlugKeys = {
  bySlug: (tagSlug: string) => [...tagKeys.all(), "by-slug", tagSlug] as const,
};

export function tagBySlugQuery(tagSlug: string) {
  return queryOptions({
    queryKey: tagBySlugKeys.bySlug(tagSlug),
    queryFn: () =>
      apiFetch<UnitTagDTO>(`/tag/by-slug/${encodeURIComponent(tagSlug)}`),
    enabled: !!tagSlug,
    staleTime: 1000 * 60 * 10,
  });
}

export function useTagBySlug(tagSlug: string) {
  return useQuery(tagBySlugQuery(tagSlug));
}
