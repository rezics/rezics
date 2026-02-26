import React from 'react';
import {useParams} from '@tanstack/react-router';
import {useAtomValue} from 'jotai';
import {useQuery} from '@tanstack/react-query';

import {bookQueries} from '@package/api/book/book';

import {bookDetailAtomFamily} from '../state/bookDetailAtoms';
import {BookDetailShell} from '../section/BookDetailSection';

import {TagWrapper} from '@/tag/component/TagWrapper.tsx';
import {AccentBarWithText} from '@package/ui/composite/typography/AccentBarWithText.tsx';
import {ArrowForwardIcon} from '@package/ui/composite/navigation/ArrowForwardIcon.tsx';
import {Box, Divider, Stack} from '@mui/material';
import {useTranslation} from 'react-i18next';

import {BookDescription} from '../component/BookDescription';
import {AuthorInfo} from '../component/AuthorInfo';
import {QuoteExcerptPreview} from '../component/QuoteExcerptPreview';
import {RemarkPreview} from '../component/RemarkPreview';

export const BookBasicInfoPage: React.FC = () => {
  const {bookId} = useParams({strict: false}) as {bookId: string};
  const {data} = useQuery({
    ...bookQueries.detail(bookId),
    enabled: Boolean(bookId),
  });
  const bookInfo = useAtomValue(bookDetailAtomFamily(bookId)) ?? data;

  const {t} = useTranslation();

  if (!bookInfo) return null;
  return (
    <BookDetailShell bookInfo={bookInfo}>
      <Stack spacing={4}>
        <BookDescription
          description={bookInfo?.description || ''}
          bookId={bookInfo?.unitId || ''}
        />
        <Divider />

        <div>
          <ArrowForwardIcon size={16} to={`/tag/book/${bookInfo?.unitId}/tag`}>
            <AccentBarWithText text={t('book.tags')} />
          </ArrowForwardIcon>
        </div>
        <TagWrapper
          filters={{objectId: bookInfo?.unitId || ''}}
          mode="grouped"
        />
        <Divider />

        <AuthorInfo
          author={
            bookInfo?.author?.[0] || {
              unitId: '',
              name: '',
              bio: '',
              description: '',
            }
          }
        />
        <Divider />

        <div>
          <ArrowForwardIcon size={16} to={`/quote/book/${bookInfo?.unitId}`}>
            <AccentBarWithText text={t('book.quote_excerpts')} />
          </ArrowForwardIcon>
        </div>
        <QuoteExcerptPreview id={bookInfo?.unitId || ''} />
        <Divider />

        <Box>
          <div>
            <ArrowForwardIcon
              size={16}
              to={`/review/book/${bookInfo?.unitId}?tab=remark`}
            >
              <AccentBarWithText text={t('book.remark')} />
            </ArrowForwardIcon>
          </div>
          <RemarkPreview bookId={bookInfo?.unitId || ''} />
        </Box>
      </Stack>
    </BookDetailShell>
  );
};
