import {Box, Divider, Paper, Stack, Typography} from '@mui/material';
import React from 'react';
import {useTranslation} from 'react-i18next';

import type {BookDTO} from '@rezics/contract';

type Book = BookDTO;

export function BookDetailSidebar({bookInfo}: {bookInfo: Book}) {
  const {t} = useTranslation();

  return (
    <Paper className="p-3 mt-4">
      <Divider className="my-4" />

      <Box>
        <Typography variant="h6" className="font-bold mb-4">
          {t('book.info_panel.title')}
        </Typography>
        <Stack spacing={1}>
          <Typography variant="body2">
            {t('book.fields.title')}：{bookInfo?.title}
          </Typography>
          <Typography variant="body2">
            {t('book.fields.author')}：{bookInfo?.author?.[0]?.name ?? ''}
          </Typography>
          <Typography variant="body2">
            {t('book.fields.press')}：{bookInfo?.press?.[0]?.name ?? ''}
          </Typography>
          <Typography variant="body2">
            {t('book.fields.producer')}：{bookInfo?.producer?.[0]?.name ?? ''}
          </Typography>
          <Typography variant="body2">
            {t('book.fields.text_length')}：{bookInfo?.textLength ?? 0}
          </Typography>
          <Typography variant="body2">
            {t('book.fields.isbn')}：{bookInfo?.isbn ?? ' '}
          </Typography>
        </Stack>
      </Box>
    </Paper>
  );
}

