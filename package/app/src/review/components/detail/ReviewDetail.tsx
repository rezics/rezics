import { useReactionHydration } from "@rezics/api/reaction/reaction";
import type { BookDTO, PostDTO } from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import type React from "react";
import { useMemo } from "react";
import { BookListViewItem } from "@/book-library/components/BookList/BookListView";
import { ReactionBar } from "@/engagement";
import { PostAuthorHeader } from "@/post/components/parts/PostAuthorHeader";
import { PostBodyMarkdown } from "@/post/components/parts/PostBodyMarkdown";
import { reviewDetailActions, reviewPolicy } from "../../models/reviewPolicy";

interface ReviewDetailProps {
  review: PostDTO;
  book?: BookDTO | null;
  onReplyInvoke?: () => void;
}

export const ReviewDetail: React.FC<ReviewDetailProps> = ({
  review,
  book,
  onReplyInvoke,
}) => {
  const { t } = useTranslation(["book"]);
const rating = (review.extra as { rating?: number } | null)?.rating;
  const title = (review.extra as { title?: string } | null)?.title;
  const hydrationIds = useMemo(
    () => (review.unitId ? [review.unitId] : []),
    [review.unitId],
  );
  useReactionHydration(hydrationIds);

  return (
    <div className="flex flex-col gap-8">
      {book && <BookListViewItem book={book} />}

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{title || t("book:pages_review_page")}</h1>
        {rating !== undefined && (
          <span className="text-sm text-text-secondary">
            {rating.toFixed(1)} / 10
          </span>
        )}
      </div>

      <PostAuthorHeader post={review} />

      <div>
        <PostBodyMarkdown content={review.content} />
      </div>

      <ReactionBar
        size="lg"
        post={review}
        policy={reviewPolicy}
        actions={reviewDetailActions}
        onReplyInvoke={onReplyInvoke}
      />
    </div>
  );
};
