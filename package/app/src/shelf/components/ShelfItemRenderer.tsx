import Stack from "@mui/material/Stack";
import type {
  EnrichedShelfItem,
  ShelfView,
  TagListEntryDTO,
} from "@rezics/api/shelf";
import type { BookDTO, PostDTO, UnitDTO, UnitTagDTO } from "@rezics/contract";
import { HorizontalBookCard } from "@/book-library/components/item/HorizontalBookCard";
import { BookCard } from "@/book-library/components/item/VerticalBookCard";
import { ExcerptCard } from "@/excerpt/components/item/ExcerptCard";
import { PostCard } from "@/post";
import { ReviewCard } from "@/review/components/item/ReviewCard";
import { getBookAuthorName } from "@/shared/utils/translation-helpers";
import { SingleTagChip } from "@/tag/components/TagList";
import { ShelfItemCard } from "./ShelfItemCard";

interface ShelfItemRendererProps {
  enriched: EnrichedShelfItem;
  viewMode: ShelfView;
}

export function ShelfItemRenderer({
  enriched,
  viewMode,
}: ShelfItemRendererProps) {
  const { item, primary, attachedReviews } = enriched;

  const renderPrimary = () => {
    switch (item.kind) {
      case "book": {
        const book = primary as BookDTO | undefined;
        if (!book) return null;
        const title = book.translations?.[0]?.title ?? item.itemRef;
        const description = book.translations?.[0]?.description ?? undefined;
        const author = getBookAuthorName(book) || undefined;
        const coverUrl = book.coverUrl ?? "";
        const href = `/book/${item.itemRef}`;
        if (viewMode === "grid") {
          return (
            <BookCard
              title={title}
              author={author}
              description={description}
              coverUrl={coverUrl}
              href={href}
            />
          );
        }
        return (
          <HorizontalBookCard
            title={title}
            author={author}
            description={description}
            coverUrl={coverUrl}
            href={href}
          />
        );
      }
      case "review": {
        const post = primary as PostDTO | undefined;
        if (!post) return null;
        return <ReviewCard review={post} />;
      }
      case "quote": {
        const post = primary as PostDTO | undefined;
        if (!post) return null;
        return <ExcerptCard excerpt={post as unknown as UnitDTO} />;
      }
      case "post": {
        const post = primary as PostDTO | undefined;
        if (!post) return null;
        return <PostCard post={post} />;
      }
      case "tag": {
        const tag = primary as TagListEntryDTO | undefined;
        if (!tag) return null;
        return <SingleTagChip tag={tag as unknown as UnitTagDTO} />;
      }
      default:
        return <ShelfItemCard item={item} />;
    }
  };

  const rendered = renderPrimary();

  if (viewMode !== "review" || attachedReviews.length === 0) {
    return rendered;
  }

  return (
    <Stack spacing={1}>
      {rendered}
      {attachedReviews.map((review) => (
        <ReviewCard key={review.unitId} review={review} />
      ))}
    </Stack>
  );
}
