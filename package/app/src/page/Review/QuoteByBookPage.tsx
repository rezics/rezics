import {AccentBarWithTextContainer} from '@/component/Common/AccentBar.tsx';
import {ArrowForwardIconContainer} from '@/component/Common/ArrowForwardIcon.tsx';
import {useParams} from 'wouter';
import {QuoteNewPage} from './QuoteNewPage';
import UnitsPage from '../Unit/UnitsPage';
import {QuoteExcerptListContainer} from '@/component/Review/QuoteExcerptList';

export function QuoteByBookPage() {
  const {bookId} = useParams();
  return (
    <div className="mt-10 mx-auto max-w-4xl w-11/12">
      <ArrowForwardIconContainer size={16}>
        <AccentBarWithTextContainer text="原文摘录" />
      </ArrowForwardIconContainer>
      <QuoteNewPage bookUnitId={bookId || ''} />
      <UnitsPage type="QUOTE" targetUnitId={bookId || ''} mode="single">
        {(units: any[]) => <QuoteExcerptListContainer data={{units}} />}
      </UnitsPage>
    </div>
  );
}
