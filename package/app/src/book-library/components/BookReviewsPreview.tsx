import { postQueries } from "@rezics/api/post/post";
import { type PostDTO, PostKind } from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import { ArrowForwardIcon } from "@rezics/ui/composite/navigation/ArrowForwardIcon.tsx";
import { AccentBarWithText } from "@rezics/ui/composite/typography/AccentBarWithText.tsx";
import { useQuery } from "@tanstack/react-query";
import type React from "react";
import { ReviewList } from "@/review/components/list/ReviewList";
import { useReadLanguageCandidates } from "@/shared/hooks/useReadLanguageCandidates";

/** Props for BookReviews component. */
interface BookReviewsProps {
  /** Book unit ID. */
  bookId: string;
  /** Book title for display. */
  title: string;
  /** Number of reviews to show. */
  reviewNumber?: number;
}

/**
 * Book Reviews Preview - Displays a preview of reviews for a book.
 * Now uses Post API with kind='review' instead of the old Review model.
 */
export const BookReviews: React.FC<BookReviewsProps> = ({
  bookId,
  title,
  reviewNumber = 3,
}) => {
  const { t } = useTranslation(["book"]);
  const languages = useReadLanguageCandidates();
  // Fetch posts with kind='review' for this book
  const { data } = useQuery({
    ...postQueries.byTarget(bookId, {
      kind: PostKind.REVIEW,
      languages,
      limit: reviewNumber,
    }),
    enabled: !!bookId,
  });

  const reviews: PostDTO[] = data?.posts?.slice(0, reviewNumber) ?? [];

  return (
    <div>
      <ArrowForwardIcon size={16} to={`/review/book/${bookId}/`}>
        <AccentBarWithText text={t("book:reviews_of_book", { title })} />
      </ArrowForwardIcon>
      <ReviewList reviews={reviews} showTargetUnit={false} />
    </div>
  );
};
