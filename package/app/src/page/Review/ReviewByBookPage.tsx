import {useNavigate} from '@tanstack/react-router';

import {ReviewsPage} from '@/page/Review/ReviewsPage';
import {AccentBarWithTextShow} from '@/component/Common/Navigation/AccentBar';
import {ReviewNewPage} from '@/page/Review/ReviewNewPage';
import {useTranslation} from 'react-i18next';
import {Button, Divider} from '@mui/material';
import {reviewByBookRoute} from '@/router/router';

export function ReviewByBookPage() {
  const {bookId} = reviewByBookRoute.useParams();
  const {t} = useTranslation();
  const navigate = useNavigate();
  return (
    <div className="w-11/12 max-w-4xl mx-auto mt-10">
      <div className="flex items-center justify-between">
        <AccentBarWithTextShow text={`${t('pages.review_page')}`} />
        <Button
          variant="outlined"
          color="primary"
          onClick={() => navigate({to: `/book/${bookId}`})}
        >
          {t('common.back')}
        </Button>
      </div>
      <div className="mt-4">
        <ReviewNewPage />
        <div className="my-4">
          <Divider />
        </div>
        <ReviewsPage bookUnitId={bookId || ''} />
      </div>
    </div>
  );
}
