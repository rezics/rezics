import {useQuery} from '@tanstack/react-query';
import {useParams} from 'wouter';

import {reviewQueries} from '@/api/review/review';
import {AccentBarWithTextShow} from '@/component/Common/AccentBar.tsx';
import {ReviewEdit} from '@/component/Review/ReviewEdit.tsx';
import {ReviewListContainer} from '@/component/Review/ReviewList.tsx';
import {useTranslation} from 'react-i18next';

export function ReviewByBookPage() {
  const {bookId} = useParams();
  const {t} = useTranslation();

  const {data, isLoading, error} = useQuery(reviewQueries.byBook(bookId || ''));

  const reviews = data?.reviews ?? [];

  return (
    <div className="w-11/12 mx-auto mt-10">
      <AccentBarWithTextShow text={`${t('pages.review_page')}`} />
      <div className="mt-4">
        <ReviewEdit />

        {isLoading ? (
          <div>Loading...</div>
        ) : error instanceof Error ? (
          <div>Error: {error.message}</div>
        ) : (
          <ReviewListContainer reviews={reviews} />
        )}
      </div>
    </div>
  );
}
