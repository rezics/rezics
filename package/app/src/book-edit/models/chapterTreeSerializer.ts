import type { ContentRating } from "@rezics/contract";
import type { Chapter } from "../components/ChapterTreeEditor";

/**
 * Serialize chapter tree for persistence in BookIndex JSON.
 *
 * Write rule: include `rating` on a node only when it differs from the book's
 * rating. When equal, the node inherits from the book and the override is
 * stripped to keep the index compact.
 */
export function serializeChapterTree(
  tree: Chapter[],
  bookRating: ContentRating | undefined,
): Chapter[] {
  return tree.map((node) => {
    const { rating, children, ...rest } = node;
    const serialized: Chapter = { ...rest };
    if (rating !== undefined && rating !== bookRating) {
      serialized.rating = rating;
    }
    if (children) {
      serialized.children = serializeChapterTree(children, bookRating);
    }
    return serialized;
  });
}
