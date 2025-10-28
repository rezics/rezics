import {Alert, CircularProgress, Typography} from '@mui/material';
import {useCallback, useEffect, useMemo, useState} from 'react';

import {BookSearch} from '@/component/BookLib/BookSearch.tsx';
// import { CardBookList } from "@component/Book/CardBookList";
import {BookSearchFilter} from '@/component/BookLib/BookSearchFilter.tsx';
import type {BookLibSortKey} from '@/component/BookLib/BookSearchFilter.tsx';
import {UniversalPaginator} from '@/component/Common/Pagination.tsx';
import type {SearchInfo} from '@/util/searchParser.ts';
import {BookListViewContainer} from '@component/BookLib/BookListView.tsx';

import React from 'react';

import {bookQueries} from '@/api/book/book';
import {useQuery} from '@tanstack/react-query';
import type {BookDTO} from '@package/contract';

function buildQuery(info: SearchInfo): string {
  let q = info.searchText.trim();
  if (info.searchTags.length) {
    q = `${q} ${info.searchTags.map((t: string) => `[${t}]`).join(' ')}`.trim();
  }
  return q;
}

type Book = BookDTO;

type BookLibShowProps = {
  books: Book[];
  totalItems: number;
  isLoading: boolean;
  error: any;
  getBookList: (info: SearchInfo) => void;
  sortConfig: {
    type: BookLibSortKey;
    order: 'asc' | 'desc';
  };
  handleNeedMoreData: any;
  handleSortChange: any;
  EXTERNAL_PAGE_SIZE: number;
};

export const BookLibShow: React.FC<BookLibShowProps> = ({
  books,
  totalItems,
  isLoading,
  error,
  getBookList,
  sortConfig,
  handleNeedMoreData,
  handleSortChange,
  EXTERNAL_PAGE_SIZE,
}) => {
  const [currentPage, setCurrentPage] = useState(1);

  if (error) {
    return (
      <div className="mx-auto max-w-7xl p-4">
        <BookSearch.Container onSearch={getBookList} />
        <Alert severity="error" className="my-4">
          {String(error)}
        </Alert>
      </div>
    );
  }

  if (books.length === 0 && !isLoading) {
    return (
      <div className="mx-auto max-w-7xl p-4">
        <BookSearch.Container onSearch={getBookList} />
        <Typography variant="body1" className="mt-4 text-center">
          No books found.
        </Typography>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl p-4">
      <BookSearch.Container onSearch={getBookList} />
      <div className="mt-4" />
      <UniversalPaginator<Book>
        data={books}
        totalExternalItems={totalItems}
        itemsPerPage={10}
        externalItemsPerPage={EXTERNAL_PAGE_SIZE}
        sortType={sortConfig.type}
        sortOrder={sortConfig.order}
        onSortChange={handleSortChange}
        requestData={handleNeedMoreData}
        isLoading={isLoading && books.length === 0}
        sortControl={
          <BookSearchFilter
            sortType={sortConfig.type}
            sortOrder={sortConfig.order}
            onSortChange={handleSortChange}
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

export const BookLibContainer: React.FC = () => {
  const EXTERNAL_PAGE_SIZE = 100;
  const [currentQuery, setCurrentQuery] = useState<SearchInfo>({
    searchText: '',
    searchTags: [],
  });
  const [start, setStart] = useState<number>(0);

  const {data, isLoading, error} = useQuery(
    bookQueries.list({
      start,
      limit: EXTERNAL_PAGE_SIZE,
    }),
  );

  function handleNeedMoreData(page: number) {
    setStart((page - 1) * EXTERNAL_PAGE_SIZE);
  }

  useEffect(() => {
    console.log('data', data);
  }, [data]);

  const books: Book[] = useMemo(() => data?.books ?? [], [data]);
  const totalItems: number = data?.total ?? 0;
  const getBookList = useCallback((info: SearchInfo) => {
    setCurrentQuery(info);
  }, []);

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
    <BookLibShow
      books={books}
      totalItems={totalItems}
      isLoading={isLoading}
      error={error}
      getBookList={getBookList}
      sortConfig={sortConfig}
      handleNeedMoreData={handleNeedMoreData}
      handleSortChange={handleSortChange}
      EXTERNAL_PAGE_SIZE={EXTERNAL_PAGE_SIZE}
    />
  );
};
