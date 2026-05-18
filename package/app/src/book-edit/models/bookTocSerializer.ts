import type { BookContentStructureItem, ContentRating } from "@rezics/contract";
import type { Chapter } from "../components/BookTocEditor";

/**
 * Serialize chapter tree for persistence.
 *
 * Write rule: include `rating` on a node only when it differs from the book's
 * rating. When equal, the node inherits from the book and the override is
 * stripped to keep the content structure compact.
 *
 * Each node's server-side `nodeId` (the BookContentStructureNode row id) is
 * emitted as the wire `id` so the server can identify the existing row on
 * save; client-created nodes without a `nodeId` are emitted without `id` and
 * the server treats them as inserts.
 */
export function serializeBookToc(
  tree: Chapter[],
  bookRating: ContentRating | undefined,
): BookContentStructureItem[] {
  return tree.map((node) => {
    const {
      id: _arboristId,
      path: _path,
      occurrenceId: _occurrenceId,
      updatedAt: _updatedAt,
      nodeId,
      rating,
      children,
      ...rest
    } = node;
    const serialized: BookContentStructureItem = { ...rest };
    if (nodeId) serialized.id = nodeId;
    if (rating !== undefined && rating !== bookRating) {
      serialized.rating = rating;
    }
    if (children) {
      serialized.children = serializeBookToc(children, bookRating);
    }
    return serialized;
  });
}
