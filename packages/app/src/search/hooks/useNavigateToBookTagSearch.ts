import { useNavigate } from "@tanstack/react-router";
import type { InjectedTag } from "../models/injectedTags";

/**
 * Navigate to the book library search page with pre-resolved tag data.
 *
 * Writes slugged tags to the `tags` URL param (comma-separated) so the page
 * is shareable. The full resolved list (including unitId for slug-less tags)
 * rides in router state as `injectedTags`, which the page uses to apply the
 * tag filter via `tagIds`.
 */
export function useNavigateToBookTagSearch() {
  const navigate = useNavigate();
  return (tags: InjectedTag[]) => {
    const slugs = tags
      .map((t) => t.slug)
      .filter((s): s is string => Boolean(s));
    navigate({
      to: "/book/search",
      search: slugs.length ? { tags: slugs.join(",") } : {},
      state: { injectedTags: tags } as never,
    });
  };
}
