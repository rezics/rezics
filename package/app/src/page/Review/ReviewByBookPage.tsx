import {useParams} from 'wouter';

import {ReviewsPage} from '@/page/Review/ReviewsPage';
import {AccentBarWithTextShow} from '@/component/Common/AccentBar.tsx';
import {ReviewNewPage} from '@/page/Review/ReviewNewPage';
import {useTranslation} from 'react-i18next';
import {Divider} from '@mui/material';

export function ReviewByBookPage() {
  const {bookId} = useParams();
  const {t} = useTranslation();

  return (
    <div className="w-11/12 max-w-4xl mx-auto mt-10">
      <AccentBarWithTextShow text={`${t('pages.review_page')}`} />
      <div className="mt-4">
        <ReviewNewPage bookUnitId={bookId || ''} />
        <div className="my-4">
          <Divider />
        </div>
        <ReviewsPage bookUnitId={bookId || ''} />
      </div>
    </div>
  );
}
