import type { BookDTO, PostDTO, ShelfItemDTO } from "@rezics/contract";
import { shelfItemReference } from "@rezics/contract";

interface TagLike {
  translations?: { language?: string; title?: string | null }[];
  label?: string;
}

export function titleOf(unit: ShelfItemDTO, cached: unknown): string {
  const fallback = shelfItemReference(unit);
  switch (unit.kind) {
    case "book": {
      const book = cached as BookDTO | undefined;
      return book?.title ?? fallback;
    }
    case "review":
    case "quote":
    case "post": {
      const post = cached as PostDTO | undefined;
      return post?.title ?? fallback;
    }
    case "tag": {
      const tag = cached as TagLike | undefined;
      return tag?.translations?.[0]?.title ?? tag?.label ?? fallback;
    }
    default:
      return fallback;
  }
}
