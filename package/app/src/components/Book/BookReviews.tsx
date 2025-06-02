import React from 'react';
import { Box, Avatar, Typography, Button, Divider, useTheme, Rating } from '@mui/material';
import { proxy, useSnapshot } from 'valtio';
import { useQuery } from 'urql';
import { ReactionBar } from '@/components/Common/ReactionBar';
import { CollapsibleText } from '@/components/Common/CollapsibleText';

const GET_BOOK_REVIEWS = `
  query GetBookReviews($bookId: ID!) {
    bookReviews(bookId: $bookId) {
      id
      content
      rating
      createdAt
      user {
        name
        avatar
      }
    }
  }
`;

interface BookReviewsProps {
  bookId: string;
}

const state = proxy({ reviews: [] });

export const BookReviews: React.FC<BookReviewsProps> = ({ bookId }) => {
  const theme = useTheme();
  const snap = useSnapshot(state);

  const [result] = useQuery({
    query: GET_BOOK_REVIEWS,
    variables: { bookId },
    pause: !bookId,
  });

  React.useEffect(() => {
    if (result.data?.bookReviews) {
      state.reviews = result.data.bookReviews;
    }
  }, [result.data]);

  return (
    <Box>
      {snap.reviews.map((review: any) => (
        <Box key={review.id}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <Avatar 
              src={review.user.avatar} 
              sx={{ width: 40, height: 40, borderRadius: 1 }}
            />
            <Box sx={{ ml: 2 }}>
              <Typography variant="subtitle1" fontWeight="bold">
                {review.user.name}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {review.createdAt}
              </Typography>
            </Box>
            <Button 
              variant="outlined" 
              size="small" 
              sx={{ ml: 2, py: 0.5 }}
            >
              Follow
            </Button>
            <Box sx={{ ml: 'auto', textAlign: 'right' }}>
              <Rating defaultValue={review.rating} precision={0.5} />
              <Typography variant="body2" color="text.secondary">
                {990} reviews {1232} followers
              </Typography>
            </Box>
          </Box>

          <Box sx={{ mt: 2 }}>
            <CollapsibleText content={review.content} threshold={300} />
          </Box>

          <Box 
            sx={{ 
              display: 'flex', 
              justifyContent: 'flex-end',
              mt: 2,
              width: {
                xs: '100%',
                sm: '75%',
                md: '50%',
                lg: '50%',
                xl: '33.33%'
              },
              mr: 2
            }}
          >
            <ReactionBar />
          </Box>

          <Divider sx={{ my: 2 }} />
        </Box>
      ))}
    </Box>
  );
};
