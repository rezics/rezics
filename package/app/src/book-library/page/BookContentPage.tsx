import React from 'react';
import {useParams} from '@tanstack/react-router';
import {useAtomValue} from 'jotai';
import {useQuery} from '@tanstack/react-query';

import {bookQueries} from '@package/api/book/book';

import {bookDetailAtomFamily} from '../state/bookDetailAtoms';
import {BookDetailShell} from '../section/BookDetailSection';
import {ChapterList} from '../component/Chapter/ChapterList';
import {Stack} from '@mui/material';

export const BookContentPage: React.FC = () => {
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
        <ChapterList id={bookInfo?.unitId || '0'} />
      </Stack>
    </BookDetailShell>
  );
};
