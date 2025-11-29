import {isEmptyValue} from '@/util/dataCheck.ts';
import React from 'react';
import {QuoteExcerptListContainer} from '../Review/QuoteExcerptList.tsx';

import {useQuery} from '@tanstack/react-query';
import {buildMeiliUnitQuery} from '@/api/meili/meili.queries';
import {UnitType} from '@package/contract/src/unit';

export type QuoteExcerptPreviewContainerProps = {
  id: string;
  quoteNumber?: number;
};

export const QuoteExcerptPreviewContainer: React.FC<
  QuoteExcerptPreviewContainerProps
> = ({id, quoteNumber = 3}) => {
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

  if (isLoading) return <div>Loading...</div>;
  if (error && !isEmptyValue(error))
    return <div>Oh no... {JSON.stringify(error)}</div>;

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
