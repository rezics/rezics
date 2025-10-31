import {
  SingleQuoteExcerptShow,
  SingleQuoteExcerptShowProps,
} from '@component/Review/SingleQuoteExcerpt.tsx';
import {Box, Stack} from '@mui/material';
import React from 'react';

type QuoteExcerpt =
  | {
      id: string;
      content: string;
      author: {
        name: string;
        avatar: string;
      };
      created_at: string;
    }
  | any;

export type QuoteExcerptListShowProps = {
  data: QuoteExcerpt[];
};

export const QuoteExcerptListShow: React.FC<QuoteExcerptListShowProps> = ({
  data,
}) => {
  return (
    <div>
      {/* Quotes */}
      <Box>
        <Stack spacing={2}>
          {(Array.isArray(data) ? data : []).map((quote: QuoteExcerpt) => (
            <SingleQuoteExcerptShow
              key={quote.id}
              author={{
                name: quote.author.name,
                avatar: quote.author.avatar || '',
              }}
              content={quote.content}
              stats={{
                replies: 0,
                likes: 0,
                date: quote.created_at,
              }}
              source={'quote.source'}
              originalLink={'quote.originalLink'}
            />
          ))}
        </Stack>
      </Box>
    </div>
  );
};

export type QuoteExcerptListContainerProps = {
  data: QuoteExcerpt[];
};

export const QuoteExcerptListContainer: React.FC<
  QuoteExcerptListContainerProps
> = ({data}) => {
  return <QuoteExcerptListShow data={data} />;
};
