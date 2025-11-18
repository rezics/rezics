import {useLocation, useParams} from 'wouter';

import {ReviewsPage} from '@/page/Review/ReviewsPage';
import {AccentBarWithTextShow} from '@/component/Common/AccentBar.tsx';
import {ReviewNewPage} from '@/page/Review/ReviewNewPage';
import {useTranslation} from 'react-i18next';
import {Button, Divider} from '@mui/material';

export function ReviewByBookPage() {
  const {bookId} = useParams();
  const {t} = useTranslation();
  const [_location, navigate] = useLocation();
  return (
    <div className="w-11/12 max-w-4xl mx-auto mt-10">
      <div className="flex items-center justify-between">
        <AccentBarWithTextShow text={`${t('pages.review_page')}`} />
        <Button
          variant="outlined"
          color="primary"
          onClick={() => navigate(`/book/${bookId}`)}
        >
          返回
        </Button>
      </div>
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
