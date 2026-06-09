import type { SearchQuery } from "@rezics/contract";
import { useNavigate } from "@tanstack/react-router";
import type { InjectedTag } from "../models/injectedTags";
import { serializeSearchString } from "../models/searchQuery";

/**
 * Navigate to the global search page with pre-resolved tag data.
 *
 * The URL `q` param only encodes tags that have a slug (canonical, shareable).
 * The full resolved list — including unitId-only and name-bearing entries —
 * rides in router state as `injectedTags` so chips render immediately without
 * a round-trip to resolve names/slugs.
 *
 * On shared/refreshed URLs the injected state is absent; the search page
 * falls back to URL-based slug resolution.
 */
export function useNavigateToTagSearch() {
  const navigate = useNavigate();
  return (tags: InjectedTag[]) => {
    const sluggableTags = tags.filter(
      (t): t is InjectedTag & { slug: string } => Boolean(t.slug),
    );
    const urlQuery: SearchQuery = {
      tags: sluggableTags.map((t) => ({ slug: t.slug })),
    };
    const q = serializeSearchString(urlQuery);
    navigate({
      to: "/search",
      search: q ? { q } : {},
      state: { injectedTags: tags } as never,
    });
  };
}
