import type { BookDTO, PostDTO, ShelfItemDTO } from "@rezics/contract";

interface TagLike {
  translations?: { language?: string; title?: string | null }[];
  label?: string;
}

export function titleOf(item: ShelfItemDTO, cached: unknown): string {
  switch (item.kind) {
    case "book": {
      const book = cached as BookDTO | undefined;
      return book?.translations?.[0]?.title ?? item.itemRef;
    }
    case "review":
    case "quote":
    case "post": {
      const post = cached as PostDTO | undefined;
      return post?.extra?.title ?? item.itemRef;
    }
    case "tag": {
      const tag = cached as TagLike | undefined;
      return tag?.translations?.[0]?.title ?? tag?.label ?? item.itemRef;
    }
    default:
      return item.itemRef;
  }
}
