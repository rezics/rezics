import { isEmptyValue } from '@/util/dataCheck.ts';
import React from 'react';
import { QuoteExcerptListContainer } from '../Review/QuoteExcerptList.tsx';

import { useQuery } from '@tanstack/react-query';
import { buildMeiliUnitQuery } from '@package/api/meili/meili.queries';
import { UnitType } from '@package/contract';
import { useTranslation } from 'react-i18next';

export type QuoteExcerptPreviewContainerProps = {
  id: string;
  quoteNumber?: number;
};

export const QuoteExcerptPreviewContainer: React.FC<
  QuoteExcerptPreviewContainerProps
> = ({ id, quoteNumber = 3 }) => {
  const { t } = useTranslation();
  const { data, isLoading, error } = useQuery(
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
