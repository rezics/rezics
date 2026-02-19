import React, {useEffect, useState} from 'react';
import {useTranslation} from 'react-i18next';

import {AccentBarWithTextShow} from '@component/Common/Navigation/AccentBar.tsx';
import {ArrowForwardIconContainer} from '@component/Common/Navigation/ArrowForwardIcon.tsx';
import {ReviewListContainer} from '@component/Review/ReviewList.tsx';

import {useQuery} from '@tanstack/react-query';
import {buildMeiliUnitQuery} from '@package/api/meili/meili.queries';
import {mapUnitListToReviewListResponse} from '@package/api/meili/meili.api';
import {UnitType, type ReviewDTO} from '@package/contract';

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
  reviewNumber = 4,
}) => {
  const {t} = useTranslation();
  const [reviews, setReviews] = useState<ReviewDTO[]>([]);

  const {data} = useQuery(
    buildMeiliUnitQuery({
      kind: UnitType.REVIEW,
      start: 0,
      targetUnitId: bookId,
      keyword: '',
      limit: reviewNumber,
      mapFn: mapUnitListToReviewListResponse,
      options: {enabled: !!bookId},
    }),
  );

  useEffect(() => {
    if (data) {
      setReviews(data.reviews ?? []);
    }
  }, [data]);

  return (
    <div>
      <ArrowForwardIconContainer size={16} to={`/review/book/${bookId}/`}>
        <AccentBarWithTextShow text={t('book.reviews_of_book', {title})} />
      </ArrowForwardIconContainer>
      <ReviewListContainer reviews={reviews?.slice(0, reviewNumber)} />
    </div>
  );
};
