import {isEmptyValue} from '@/shared/util/data-check.ts';
import React from 'react';
import {QuoteExcerptListContainer} from '@component/Review/QuoteExcerptList.tsx';

import {useQuery} from '@tanstack/react-query';
import {buildMeiliUnitQuery} from '@package/api/meili/meili.queries';
import {UnitType} from '@package/contract';
import {useTranslation} from 'react-i18next';

/** Props for QuoteExcerptPreview component. */
export type QuoteExcerptPreviewProps = {
  /** Book or target unit ID. */
  id: string;
  /** Number of quotes to display. */
  quoteNumber?: number;
};

/**
 * Quote Excerpt Preview - Displays a preview of quotes for a book.
 */
export const QuoteExcerptPreview: React.FC<QuoteExcerptPreviewProps> = ({
  id,
  quoteNumber = 3,
}) => {
  const {t} = useTranslation();
  const {data, isLoading, error} = useQuery(
    buildMeiliUnitQuery(
      UnitType.QUOTE,
      0,
      id,
      '',
      quoteNumber,
      unitResp => unitResp,
      {
        enabled: !!id,
      },
    ),
  );

  if (isLoading) return <div>{t('common.loading')}</div>;
  if (error && !isEmptyValue(error))
    return (
      <div>
        {t('common.error_generic')} {JSON.stringify(error)}
      </div>
    );

  return (
    <div>
      <QuoteExcerptListContainer
        data={{
          units: data?.units?.slice(0, quoteNumber) || [],
          total: data?.total,
        }}
      />
    </div>
  );
};

// Legacy export for backward compatibility
export {QuoteExcerptPreview as QuoteExcerptPreviewContainer};
