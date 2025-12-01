import {Alert} from '@mui/material';
import {useEffect, useImperativeHandle, useMemo, useState} from 'react';

import {BookSearchContainer} from '@/component/BookLib/BookSearch/BookSearch';
import type {BookLibSortKey} from '@/component/Search/SearchFilter';
import {
  UniversalPaginator,
  type UniversalPaginatorHandle,
} from '@/component/Common/Pagination.tsx';
import type {SearchInfo} from '@/component/Search/searchParser';
import {BookListViewContainer} from '@/component/BookLib/BookList/BookListView';

import React, {forwardRef, useRef} from 'react';

import {meiliQueries} from '@/api/meili/meili.queries';
import {useQueryClient, useQuery} from '@tanstack/react-query';

import type {BookDTO} from '@package/contract';

type Book = BookDTO;

type BookLibShowProps = {
  books: Book[];
  totalItems: number;
  isLoading: boolean;
  error: any;
  sortConfig: {
    type: BookLibSortKey;
    order: 'asc' | 'desc';
  };
  handleNeedMoreData: any;
  handlePreRequestData: any;
  handleSortChange: any;
  EXTERNAL_PAGE_SIZE: number;
  setCurrentQuery: any;
  currentQuery: SearchInfo;
};

export const BookLibShow = (
  {
    books,
    totalItems,
    isLoading,
    error,
    sortConfig,
    handleNeedMoreData,
    handlePreRequestData,
    handleSortChange,
    EXTERNAL_PAGE_SIZE,
    setCurrentQuery,
    currentQuery,
  }: BookLibShowProps,
  ref: React.Ref<UniversalPaginatorHandle>,
) => {
  const [currentPage, setCurrentPage] = useState(1);
  const universalPaginatorRef = useRef<UniversalPaginatorHandle>(null);

  useEffect(() => {
    console.log('currentQuery', currentQuery);
  }, [currentQuery]);

  useImperativeHandle(ref, () => ({
    resetPaginationPageNumber() {
      universalPaginatorRef.current?.resetPaginationPageNumber();
    },
  }));

  if (error) {
    return (
      <div className="mx-auto max-w-7xl p-4">
        <BookSearchContainer onSearch={() => {}} />
        <Alert severity="error" className="my-4">
          {String(error)}
        </Alert>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl p-4">
      <UniversalPaginator<Book>
        ref={universalPaginatorRef}
        data={books}
        totalExternalItems={totalItems}
        itemsPerPage={10}
        externalItemsPerPage={EXTERNAL_PAGE_SIZE}
        sortType={sortConfig.type}
        sortOrder={sortConfig.order}
        onSortChange={handleSortChange}
        requestData={handleNeedMoreData}
        preRequestData={handlePreRequestData}
        isLoading={isLoading && books.length === 0}
        sortControl={
          <BookSearchContainer
            onSearch={info => {
              setCurrentQuery({
                keyword: info.keyword ?? '',
                tags: info.tags ?? [],
                nsfw: info.nsfw ?? false,
                textLength: info.textLength ?? '',
              });
              console.log('onSearch', info);
            }}
            defaultValue={currentQuery}
          />
        }
        currentPage={currentPage}
        setCurrentPage={setCurrentPage}
      >
        {(currentPageItems: Book[]) => (
          <BookListViewContainer books={currentPageItems} />
        )}
      </UniversalPaginator>
      {/* <CardBookList books={books} /> */}
    </div>
  );
};

export const BookLibShowRef = forwardRef(BookLibShow);

export const BookLibContainer: React.FC = () => {
  const ref = useRef<UniversalPaginatorHandle>(null);
  const EXTERNAL_PAGE_SIZE = 100;
  const [currentQuery, setCurrentQuery] = useState<SearchInfo>({
    keyword: '',
    tags: [],
    nsfw: false,
    textLength: '',
  });
  const [start, setStart] = useState<number>(0);

  const {data, isLoading, error} = useQuery(
    meiliQueries.booksSearch({
      start,
      limit: EXTERNAL_PAGE_SIZE,
      keyword: currentQuery.keyword ?? '',
      tags: currentQuery.tags ?? [],
      ...(currentQuery.nsfw ? {nsfw: true} : {}),
      ...(currentQuery.textLength ? {textLength: currentQuery.textLength} : {}),
    }),
  );

  function handleNeedMoreData(page: number) {
    setStart((page - 1) * EXTERNAL_PAGE_SIZE);
  }

  const queryClient = useQueryClient();
  async function handlePreRequestData(page: number) {
    const data = await queryClient.fetchQuery(
      meiliQueries.booksSearch({
        start: (page - 1) * EXTERNAL_PAGE_SIZE,
        limit: EXTERNAL_PAGE_SIZE,
        keyword: currentQuery.keyword ?? '',
        tags: currentQuery.tags ?? [],
        ...(currentQuery.nsfw ? {nsfw: true} : {}),
        ...(currentQuery.textLength
          ? {textLength: currentQuery.textLength}
          : {}),
      }),
    );
    console.log('handlePreRequestData', data, page);
    return data?.books?.length;
  }

  useEffect(() => {
    console.log('data', data);
  }, [data]);

  useEffect(() => {
    ref.current?.resetPaginationPageNumber();
    console.log('currentQuery', currentQuery);
  }, [currentQuery]);

  const books: Book[] = useMemo(() => data?.books ?? [], [data]);
  const totalItems: number = data?.total ?? 0;

  const handleSortChange = (newSort: {
    type?: string;
    order?: 'asc' | 'desc';
  }) => {
    console.log('handleSortChange, newSort', newSort);
    setSortConfig(prev => ({
      type: newSort.type as BookLibSortKey,
      order: newSort.order ?? prev.order,
    }));
  };

  const [sortConfig, setSortConfig] = useState<{
    type: BookLibSortKey;
    order: 'asc' | 'desc';
  }>({
    type: 'time',
    order: 'desc',
  });
  return (
    <BookLibShowRef
      ref={ref}
      books={books}
      totalItems={totalItems}
      isLoading={isLoading}
      error={error}
      currentQuery={currentQuery}
      setCurrentQuery={setCurrentQuery}
      sortConfig={sortConfig}
      handleNeedMoreData={handleNeedMoreData}
      handlePreRequestData={handlePreRequestData}
      handleSortChange={handleSortChange}
      EXTERNAL_PAGE_SIZE={EXTERNAL_PAGE_SIZE}
    />
  );
};
