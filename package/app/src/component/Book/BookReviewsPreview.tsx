import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { AccentBarWithTextShow } from '../Common/Navigation/AccentBar.tsx';
import { ArrowForwardIconContainer } from '../Common/Navigation/ArrowForwardIcon.tsx';
import { ReviewListContainer } from '../Review/ReviewList.tsx';

import { useQuery } from '@tanstack/react-query';
import { buildMeiliUnitQuery } from '@package/api/meili/meili.queries';
import { mapUnitListToReviewListResponse } from '@package/api/meili/meili.api';
import { UnitType } from '@package/contract';
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
  const { t } = useTranslation();
  const [reviews, setReviews] = useState<any[]>([]);

  const { data } = useQuery(
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
        <AccentBarWithTextShow text={t('book.reviews_of_book', { title })} />
      </ArrowForwardIconContainer>
      <ReviewListContainer reviews={reviews?.slice(0, reviewNumber)} />
    </div>
  );
};
