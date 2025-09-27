import React, { useEffect, useState } from "react";

import { AccentBarWithTextShow } from "../Common/AccentBar.tsx";
import { ArrowForwardIconContainer } from "../Common/ArrowForwardIcon.tsx";
import { ReviewList } from "../Review/ReviewList.tsx";

import { reviewQueries } from "@/api/Review.ts";
import { useQuery } from "@tanstack/react-query";
interface BookReviewsProps {
  bookId: string;
  title: string;
}

export const BookReviews: React.FC<BookReviewsProps> = ({ bookId, title }) => {
  const [reviews, setReviews] = useState<any[]>([]);

  const { data, isLoading, error } = useQuery(reviewQueries.list(bookId, 4));

  useEffect(() => {
    if (data) {
      setReviews(data.items);
    }
  }, [data]);

  return (
    <div>
      <ArrowForwardIconContainer
        size={16}
        to={`/review/book/${bookId}/`}
      >
        <AccentBarWithTextShow text={`${title}的书评`} />
      </ArrowForwardIconContainer>
      <ReviewList.Container reviews={reviews} />
    </div>
  );
};
