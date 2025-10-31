import {isEmptyValue} from '@/util/dataCheck.ts';
import React from 'react';
import {QuoteExcerptListContainer} from '../Review/QuoteExcerptList.tsx';

import {reviewQueries} from '@/api/review/review';
import {useQuery} from '@tanstack/react-query';

interface QuoteExcerpt {
  id: string;
  content: string;
  author: {name: string; avatar: string};
  created_at: string;
}

export type QuoteExcerptPreviewShowProps = {
  id?: string;
  data: QuoteExcerpt[];
  isLoading: boolean;
  error?: string;
};

export const QuoteExcerptPreviewShow: React.FC<
  QuoteExcerptPreviewShowProps
> = ({data, isLoading, error}) => {
  if (isLoading) return <div>Loading...</div>;
  if (error && !isEmptyValue(error)) return <div>Oh no... {error}</div>;

  return (
    <div>
      <QuoteExcerptListContainer data={data || []} />
    </div>
  );
};

export type QuoteExcerptPreviewContainerProps = {
  id: string;
};

export const QuoteExcerptPreviewContainer: React.FC<
  QuoteExcerptPreviewContainerProps
> = ({id}) => {
  // 使用最新的 Review API：按书籍获取评测，限制数量为 3
  const {data, isLoading, error} = useQuery(
    reviewQueries.byBook(id, {limit: 3}),
  );

  // 将 ReviewDTO[] 映射为 QuoteExcerptList 期望的数据结构
  const quote = (data?.reviews ?? []).map((r: any) => ({
    id: r.id,
    content: r.content,
    author: {
      name: r.user?.name ?? '',
      avatar: r.user?.avatar ?? '',
    },
    created_at: r.created_at ?? '',
  }));

  return (
    <QuoteExcerptPreviewShow
      data={quote}
      isLoading={isLoading}
      error={error && error instanceof Error ? error.message : undefined}
    />
  );
};
