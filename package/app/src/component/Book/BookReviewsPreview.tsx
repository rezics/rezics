import React, {useEffect, useState} from 'react';

import {AccentBarWithTextShow} from '../Common/AccentBar.tsx';
import {ArrowForwardIconContainer} from '../Common/ArrowForwardIcon.tsx';
import {ReviewListContainer} from '../Review/ReviewList.tsx';

import {useQuery} from '@tanstack/react-query';
import {buildMeiliUnitQuery} from '@/api/meili/meili.queries';
import {mapUnitListToReviewListResponse} from '@/api/meili/meili.api';
import {UnitType} from '@package/contract/src/unit';
interface BookReviewsProps {
  bookId: string;
  title: string;
  reviewNumber?: number;
}

export const BookReviews: React.FC<BookReviewsProps> = ({
  bookId,
  title,
  reviewNumber = 4,
}) => {
  const [reviews, setReviews] = useState<any[]>([]);

  const {data} = useQuery(
    buildMeiliUnitQuery(
      UnitType.REVIEW,
      0,
      bookId,
      '',
      reviewNumber,
      mapUnitListToReviewListResponse,
      {
        enabled: !!bookId,
      },
    ),
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
      <ReviewListContainer reviews={reviews?.slice(0, reviewNumber)} />
    </div>
  );
};
