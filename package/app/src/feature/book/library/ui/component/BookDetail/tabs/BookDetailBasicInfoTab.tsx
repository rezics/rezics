import {TagWrapper} from '@/component/Tag/TagWrapper.tsx';
import {AccentBarWithTextContainer} from '@/component/Common/Navigation/AccentBar';
import {ArrowForwardIconContainer} from '@/component/Common/Navigation/ArrowForwardIcon';
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
export const BookDetailBasicInfoTab: React.FC<{bookInfo: BookDTO}> = ({bookInfo}) => {
  const {t} = useTranslation();

  return (
    <Stack spacing={4}>
      <BookDescription
        description={bookInfo?.description || ''}
        bookId={bookInfo?.unitId || ''}
      />
      <Divider />

      <div>
        <ArrowForwardIconContainer
          size={16}
          to={`/tag/book/${bookInfo?.unitId}/tag`}
        >
          <AccentBarWithTextContainer text={t('book.tags')} />
        </ArrowForwardIconContainer>
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
        <ArrowForwardIconContainer size={16} to={`/quote/book/${bookInfo?.unitId}`}>
          <AccentBarWithTextContainer text={t('book.quote_excerpts')} />
        </ArrowForwardIconContainer>
      </div>
      <QuoteExcerptPreview id={bookInfo?.unitId || ''} />
      <Divider />

      <Box>
        <div>
          <ArrowForwardIconContainer
            size={16}
            to={`/review/book/${bookInfo?.unitId}?tab=remark`}
          >
            <AccentBarWithTextContainer text={t('book.remark')} />
          </ArrowForwardIconContainer>
        </div>
        <RemarkPreview bookId={bookInfo?.unitId || ''} />
      </Box>
    </Stack>
  );
};

