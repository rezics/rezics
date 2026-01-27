import { AccentBarWithTextContainer } from '@/component/Common/Navigation/AccentBar';
import { ArrowForwardIconContainer } from '@/component/Common/Navigation/ArrowForwardIcon';
import { QuoteNewPage } from './QuoteNewPage';
import { useTranslation } from 'react-i18next';
import UnitsPage from '../Unit/UnitsPage';
import { QuoteExcerptListContainer } from '@/component/Review/QuoteExcerptList';
import { quoteByBookRoute } from '@/router';

export function QuoteByBookPage() {
  const { bookId } = quoteByBookRoute.useParams();
  const { t } = useTranslation();
  return (
    <div className="mt-10 mx-auto max-w-4xl w-11/12">
      <ArrowForwardIconContainer size={16}>
        <AccentBarWithTextContainer text={t('quote.excerpts_title')} />
      </ArrowForwardIconContainer>
      <QuoteNewPage bookUnitId={bookId || ''} />
      <UnitsPage type="QUOTE" targetUnitId={bookId || ''} mode="single">
        {(units: any[]) => <QuoteExcerptListContainer data={{ units }} />}
      </UnitsPage>
    </div>
  );
}
