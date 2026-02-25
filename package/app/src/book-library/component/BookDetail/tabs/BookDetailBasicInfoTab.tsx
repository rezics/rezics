import {TagWrapper} from '@/tag/component/TagWrapper.tsx';
import {AccentBarWithText} from '@package/ui/composite/typography/AccentBarWithText.tsx';
import {ArrowForwardIcon} from '@package/ui/composite/navigation/ArrowForwardIcon.tsx';
import {Box, Divider, Stack} from '@mui/material';
import React from 'react';
import {useTranslation} from 'react-i18next';

import type {BookDTO} from '@package/contract';
import {BookDescription} from '../../BookDescription';
import {AuthorInfo} from '../../AuthorInfo';
import {QuoteExcerptPreview} from '../../QuoteExcerptPreview';
import {RemarkPreview} from '../../RemarkPreview';

/**
 * Book Detail Basic Info Tab - Displays book description, tags, author, quotes, and remarks.
 */
export const BookDetailBasicInfoTab: React.FC<{bookInfo: BookDTO}> = ({
  bookInfo,
}) => {
  const {t} = useTranslation();

  return (
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
      <TagWrapper filters={{objectId: bookInfo?.unitId || ''}} mode="grouped" />
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
  );
};
