import React from 'react';
import {Stack} from '@mui/material';

import type {BookDTO} from '@package/contract';
import {ChapterList} from '../../Chapter/ChapterList';

/**
 * Book Detail TOC Tab - Displays table of contents for a book.
 */
export const BookDetailTocTab: React.FC<{bookInfo: BookDTO}> = ({bookInfo}) => {
  return (
    <Stack spacing={4}>
      <ChapterList id={bookInfo?.unitId || '0'} />
    </Stack>
  );
};

