import type { SearchQuery } from "@rezics/contract";
import { useNavigate } from "@tanstack/react-router";
import { useCallback } from "react";
import type { InjectedTag } from "../models/injectedTags";
import { serializeSearchString } from "../models/searchQuery";

/**
 * Navigate to the global search page with pre-resolved tag data.
 *
 * The URL uses `[slug]` syntax in the `q` param (canonical, shareable).
 * Pre-resolved objects are passed through router state as `injectedTags`
 * so the search page can render tag chips and execute the query without
 * a round-trip to resolve slugs.
 *
 * On shared/refreshed URLs the injected state is absent; the search page
 * falls back to URL-based slug resolution.
 */
export function useNavigateToTagSearch() {
  const navigate = useNavigate();
  return useCallback(
    (tags: InjectedTag[]) => {
      const query: SearchQuery = {
        tags: tags.map((t) => ({ slug: t.slug })),
      };
      const q = serializeSearchString(query);
      navigate({
        to: "/search",
        search: { q },
        state: { injectedTags: tags } as never,
      });
    },
    [navigate],
  );
}
