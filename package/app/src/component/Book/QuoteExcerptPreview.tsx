import {isEmptyValue} from '@/util/dataCheck.ts';
import React from 'react';
import {QuoteExcerptListContainer} from '../Review/QuoteExcerptList.tsx';

import {unitQueries} from '@/api/unit/unit';
import {useQuery} from '@tanstack/react-query';

export type QuoteExcerptPreviewContainerProps = {
  id: string;
};

export const QuoteExcerptPreviewContainer: React.FC<
  QuoteExcerptPreviewContainerProps
> = ({id}) => {
  // 使用最新的 Review API：按书籍获取评测，限制数量为 3
  const {data, isLoading, error} = useQuery(
    unitQueries.list({limit: 3, type: 'QUOTE', targetUnitId: id}),
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
