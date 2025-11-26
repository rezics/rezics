import {isEmptyValue} from '@/util/dataCheck.ts';
import React from 'react';
import {QuoteExcerptListContainer} from '../Review/QuoteExcerptList.tsx';

import {useQuery} from '@tanstack/react-query';
import {buildMeiliUnitQuery} from '@/api/meili/meili.queries';
import {UnitType} from '@package/contract/src/unit';

export type QuoteExcerptPreviewContainerProps = {
  id: string;
};

export const QuoteExcerptPreviewContainer: React.FC<
  QuoteExcerptPreviewContainerProps
> = ({id}) => {
  const {data, isLoading, error} = useQuery(
    buildMeiliUnitQuery(
      UnitType.QUOTE,
      0,
      id,
      '',
      3,
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
      <QuoteExcerptListContainer data={data || {units: [], total: 0}} />
    </div>
  );
};
