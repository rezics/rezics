import { meiliTagSearchQueryOptions } from "@rezics/api/meili/meili.queries";
import { useLocale } from "@rezics/i18n/react";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";

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
  const [debounced, setDebounced] = useState(input);

  useEffect(() => {
    const handle = setTimeout(() => setDebounced(input), 250);
    return () => clearTimeout(handle);
  }, [input]);

  const trimmed = debounced.trim();
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
