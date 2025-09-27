import { isEmptyValue } from "@/util/dataCheck.ts";
import React from "react";
import { QuoteExcerptList } from "../Review/QuoteExcerptList.tsx";

import { reviewApi, reviewQueries } from "@/api/Review.ts";
import { useQuery } from "@tanstack/react-query";

interface QuoteExcerpt {
  id: string;
  content: string;
  author: string;
  createdAt: string;
  updatedAt: string;
}

export type QuoteExcerptPreviewShowProps = {
  id?: string;
  data: QuoteExcerpt[];
  isLoading: boolean;
  error?: string;
};

export const QuoteExcerptPreviewShow: React.FC<QuoteExcerptPreviewShowProps> = ({ data, isLoading, error }) => {
  if (isLoading) return <div>Loading...</div>;
  if (error && !isEmptyValue(error)) return <div>Oh no... {error}</div>;

  return (
    <div>
      <QuoteExcerptList.Container data={data || []} />
    </div>
  );
};

export type QuoteExcerptPreviewContainerProps = {
  id: string;
};

export const QuoteExcerptPreviewContainer: React.FC<QuoteExcerptPreviewContainerProps> = ({ id }) => {
  const { data, isLoading, error } = useQuery(reviewQueries.quoteList(id, 3));
  // const quote = (data || []) as QuoteExcerpt[];
  const quote = (data || []) as any[];
  return <QuoteExcerptPreviewShow data={quote} isLoading={isLoading} error={error?.message} />;
};
