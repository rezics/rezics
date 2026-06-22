import { meiliTagSearchQueryOptions } from "@rezics/api/meili/meili.queries";
import { useLocale } from "@rezics/i18n/react";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { useDebouncedValue } from "@/shared/hooks/useDebouncedValue";

export type TagSuggestion = {
  slug: string;
  unitId?: string;
  name?: string;
};

export function useTagSuggest(input: string): {
  suggestions: TagSuggestion[];
  loading: boolean;
} {
  const locale = useLocale();
  const trimmed = useDebouncedValue(input, 250).trim();
  const query = useQuery({
    ...meiliTagSearchQueryOptions({
      keyword: trimmed,
      limit: 20,
      appLocale: locale,
    }),
    enabled: trimmed.length > 0,
  });

  const suggestions = useMemo<TagSuggestion[]>(
    () =>
      (query.data?.items ?? []).map((tag) => ({
        unitId: tag.unitId,
        slug: tag.slug ?? undefined,
        name: tag.title ?? tag.slug ?? tag.unitId,
      })),
    [query.data?.items],
  );

  if (trimmed.length === 0) {
    return { suggestions: [], loading: false };
  }

  return { suggestions, loading: query.isLoading || query.isFetching };
}
