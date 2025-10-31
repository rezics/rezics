import React, {useEffect, useState} from 'react';

import {AccentBarWithTextShow} from '../Common/AccentBar.tsx';
import {ArrowForwardIconContainer} from '../Common/ArrowForwardIcon.tsx';
import {ReviewListContainer} from '../Review/ReviewList.tsx';

import {reviewQueries} from '@/api/review/review';
import {useQuery} from '@tanstack/react-query';
interface BookReviewsProps {
  bookId: string;
  title: string;
}

export const BookReviews: React.FC<BookReviewsProps> = ({bookId, title}) => {
  const [reviews, setReviews] = useState<any[]>([]);

  const {data, isLoading, error} = useQuery(
    reviewQueries.byBook(bookId, {limit: 4}),
  );

  useEffect(() => {
    if (data) {
      setReviews(data.reviews ?? []);
    }
  }, [data]);

  return (
    <div>
      <ArrowForwardIconContainer size={16} to={`/review/book/${bookId}/`}>
        <AccentBarWithTextShow text={`${title}的书评`} />
      </ArrowForwardIconContainer>
      <ReviewListContainer reviews={reviews} />
    </div>
  );
};
