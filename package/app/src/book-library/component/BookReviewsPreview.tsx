import { mapUnitListToReviewListResponse } from "@rezics/api/meili/meili.api";
import { buildMeiliUnitQuery } from "@rezics/api/meili/meili.queries";
import { type ReviewDTO, UnitType } from "@rezics/contract";
import { ArrowForwardIcon } from "@rezics/ui/composite/navigation/ArrowForwardIcon.tsx";
import { AccentBarWithText } from "@rezics/ui/composite/typography/AccentBarWithText.tsx";

import { useQuery } from "@tanstack/react-query";
import type React from "react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ReviewList } from "@/review/component/ReviewList.tsx";

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
 */
export const BookReviews: React.FC<BookReviewsProps> = ({
  bookId,
  title,
  reviewNumber = 3,
}) => {
  const { t } = useTranslation();
  const [reviews, setReviews] = useState<ReviewDTO[]>([]);

  const { data } = useQuery(
    buildMeiliUnitQuery({
      kind: UnitType.REVIEW,
      start: 0,
      targetUnitId: bookId,
      keyword: "",
      limit: reviewNumber,
      mapFn: mapUnitListToReviewListResponse,
      options: { enabled: !!bookId },
    }),
  );

  useEffect(() => {
    if (data) {
      setReviews(data.reviews ?? []);
    }
  }, [data]);

  return (
    <div>
      <ArrowForwardIcon size={16} to={`/review/book/${bookId}/`}>
        <AccentBarWithText text={t("book.reviews_of_book", { title })} />
      </ArrowForwardIcon>
      <ReviewList reviews={reviews?.slice(0, reviewNumber)} />
    </div>
  );
};
