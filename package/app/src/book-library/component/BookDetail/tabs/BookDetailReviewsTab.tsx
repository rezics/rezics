import React from 'react';
import {Stack} from '@mui/material';

import type {BookDTO} from '@package/contract';
import {BookReviews} from '../../BookReviewsPreview';
import {ReadlistByBookPreview} from '../../ReadlistByBookPreview';

/**
 * Book Detail Reviews Tab - Displays reviews and readlists for a book.
 *
 * This is a tab panel component used within BookDetailSection.
 */
export const BookDetailReviewsTab: React.FC<{bookInfo: BookDTO}> = ({bookInfo}) => {
  return (
    <Stack spacing={4}>
      <BookReviews bookId={bookInfo?.unitId || ''} title={bookInfo?.title || ''} />

      <ReadlistByBookPreview
        bookId={bookInfo?.unitId || ''}
        title={bookInfo?.title || ''}
      />
    </Stack>
  );
};

