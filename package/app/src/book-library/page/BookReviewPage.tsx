import React from 'react';
import {useParams} from '@tanstack/react-router';
import {useAtomValue} from 'jotai';
import {useQuery} from '@tanstack/react-query';

import {bookQueries} from '@rezics/api/book/book';

import {bookDetailAtomFamily} from '../state/bookDetailAtoms';
import {BookDetailShell} from '../section/BookDetailSection';

import {Stack} from '@mui/material';
import {BookReviews} from '../component/BookReviewsPreview';
import {ReadlistByBookPreview} from '../component/ReadlistByBookPreview';

export const BookReviewPage: React.FC = () => {
  const {bookId} = useParams({strict: false}) as {bookId: string};
  const {data} = useQuery({
    ...bookQueries.detail(bookId),
    enabled: Boolean(bookId),
  });
  const bookInfo = useAtomValue(bookDetailAtomFamily(bookId)) ?? data;

  if (!bookInfo) return null;

  return (
    <BookDetailShell bookInfo={bookInfo}>
      <Stack spacing={4}>
        <BookReviews
          bookId={bookInfo?.unitId || ''}
          title={bookInfo?.title || ''}
        />

        <ReadlistByBookPreview
          bookId={bookInfo?.unitId || ''}
          title={bookInfo?.title || ''}
        />
      </Stack>
    </BookDetailShell>
  );
};
