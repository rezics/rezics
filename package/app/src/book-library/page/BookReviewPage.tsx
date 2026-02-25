import React from 'react';
import {useParams} from '@tanstack/react-router';
import {useAtomValue} from 'jotai';
import {useQuery} from '@tanstack/react-query';

import {bookQueries} from '@package/api/book/book';

import {BookDetailReviewsTab} from '../component/BookDetail/tabs/BookDetailReviewsTab';
import {bookDetailAtomFamily} from '../state/bookDetailAtoms';
import {BookDetailShell} from '../section/BookDetailSection';

export const BookReviewPage: React.FC = () => {
  const {bookId} = useParams({strict: false}) as {bookId: string};
  const {data} = useQuery({...bookQueries.detail(bookId), enabled: Boolean(bookId)});
  const bookInfo = useAtomValue(bookDetailAtomFamily(bookId)) ?? data;

  if (!bookInfo) return null;

  return (
    <BookDetailShell bookInfo={bookInfo}>
      <BookDetailReviewsTab bookInfo={bookInfo} />
    </BookDetailShell>
  );
};
