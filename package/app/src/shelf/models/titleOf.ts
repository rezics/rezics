import type { BookDTO, PostDTO, ShelfItemDTO } from "@rezics/contract";

interface TagLike {
  translations?: { language?: string; title?: string | null }[];
  label?: string;
}

export function titleOf(unit: ShelfItemDTO, cached: unknown): string {
  switch (unit.kind) {
    case "book": {
      const book = cached as BookDTO | undefined;
      return book?.title ?? unit.unitId;
    }
    case "review":
    case "quote":
    case "post": {
      const post = cached as PostDTO | undefined;
      return post?.title ?? unit.unitId;
    }
    case "tag": {
      const tag = cached as TagLike | undefined;
      return tag?.translations?.[0]?.title ?? tag?.label ?? unit.unitId;
    }
    default:
      return unit.unitId;
  }
}
