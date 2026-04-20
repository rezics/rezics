import Stack from "@mui/material/Stack";
import { bookKeys } from "@rezics/api/book/book.keys";
import { postKeys } from "@rezics/api/post/post.keys";
import type { ShelfItemDTO, ShelfView } from "@rezics/api/shelf";
import { tagKeys } from "@rezics/api/tag/tag.keys";
import type { BookDTO, PostDTO, UnitDTO, UnitTagDTO } from "@rezics/contract";
import { useQueryClient } from "@tanstack/react-query";
import { BookCard } from "@/book-library/components/item/VerticalBookCard";
import { ExcerptCard } from "@/excerpt/components/item/ExcerptCard";
import { PostCard } from "@/post";
import { ReviewCard } from "@/review/components/item/ReviewCard";
import { getBookAuthorName } from "@/shared/utils/translation-helpers";
import { SingleTagChip } from "@/tag/components/TagList";
import { ShelfItemCard } from "./ShelfItemCard";

interface ShelfItemRendererProps {
  item: ShelfItemDTO;
  viewMode: ShelfView;
}

export function ShelfItemRenderer({ item, viewMode }: ShelfItemRendererProps) {
  const queryClient = useQueryClient();

  const renderPrimary = () => {
    switch (item.kind) {
      case "book": {
        const book = queryClient.getQueryData<BookDTO>(
          bookKeys.detail(item.itemRef),
        );
        if (!book) return null;
        const title = book.translations?.[0]?.title ?? item.itemRef;
        const description = book.translations?.[0]?.description ?? undefined;
        return (
          <BookCard
            title={title}
            author={getBookAuthorName(book) || undefined}
            description={description ?? undefined}
            coverUrl={book.coverUrl ?? ""}
            href={`/book/${item.itemRef}`}
          />
        );
      }
      case "review": {
        const post = queryClient.getQueryData<PostDTO>(
          postKeys.detail(item.itemRef),
        );
        if (!post) return null;
        return <ReviewCard review={post} />;
      }
      case "quote": {
        const post = queryClient.getQueryData<PostDTO>(
          postKeys.detail(item.itemRef),
        );
        if (!post) return null;
        return <ExcerptCard excerpt={post as unknown as UnitDTO} />;
      }
      case "post": {
        const post = queryClient.getQueryData<PostDTO>(
          postKeys.detail(item.itemRef),
        );
        if (!post) return null;
        return <PostCard post={post} />;
      }
      case "tag": {
        const tag = queryClient.getQueryData<UnitTagDTO>(
          tagKeys.detail(item.itemRef),
        );
        if (!tag) return null;
        return <SingleTagChip tag={tag} />;
      }
      default:
        return <ShelfItemCard item={item} />;
    }
  };

  const primary = renderPrimary();

  if (viewMode !== "review" || item.reviewIds.length === 0) {
    return primary;
  }

  const attachedReviews = item.reviewIds
    .map((id) => queryClient.getQueryData<PostDTO>(postKeys.detail(id)))
    .filter((p): p is PostDTO => p != null);

  if (attachedReviews.length === 0) return primary;

  return (
    <Stack spacing={1}>
      {primary}
      {attachedReviews.map((review) => (
        <ReviewCard key={review.unitId} review={review} />
      ))}
    </Stack>
  );
}
