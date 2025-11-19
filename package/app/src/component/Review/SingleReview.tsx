import {CollapsibleText} from '@component/Common/CollapsibleText';
import {ReactionBarShow} from '@component/Common/ReactionBar';
import {EmojiEvents, SentimentSatisfiedAlt} from '@mui/icons-material';
import {
  Avatar,
  Box,
  Button,
  Divider,
  IconButton,
  Rating,
  Tooltip,
  Typography,
} from '@mui/material';
import {type ReviewDTO} from '@package/contract';
import React from 'react';
import {CollapsibleReview} from '@/component/ReadList/Review';

const ReviewHeader: React.FC<{review: ReviewDTO; onFollow?: () => void}> = ({
  review,
  onFollow,
}) => {
  return (
    <Box sx={{display: 'flex', alignItems: 'center', mb: 2}}>
      <Avatar
        src={review.user?.avatar ?? ''}
        sx={{width: 40, height: 40, borderRadius: 1}}
      />
      <Box sx={{ml: 2}}>
        <Typography variant="subtitle1" fontWeight="bold">
          {review.user?.name}
        </Typography>

        <Typography variant="body2" color="text.secondary">
          {990} reviews {1232} followers
        </Typography>
      </Box>
      <Button
        variant="outlined"
        size="small"
        sx={{ml: 2, py: 0.5}}
        onClick={onFollow}
      >
        Follow
      </Button>
      <Box sx={{ml: 'auto', textAlign: 'right'}}>
        <Rating defaultValue={review.rating} precision={0.5} readOnly />
        <Typography variant="body2" color="text.secondary">
          {review.created_at}
        </Typography>
      </Box>
    </Box>
  );
};

const ReviewFooter: React.FC<{
  review: ReviewDTO;
  onReply: (reviewId: string) => void;
}> = ({review, onReply}) => {
  return (
    <div>
      <Box className="w-full flex justify-end">
        <Box
          sx={{
            width: {
              xs: '100%',
              sm: '75%',
              md: '50%',
              lg: '50%',
              xl: '33.33%',
            },
          }}
        >
          <ReactionBarShow
            onReply={() => onReply(review.unitId)}
            itemUrl={`/review/${review.unitId}`}
            hideReply={true}
          />
        </Box>
      </Box>
      {/* Statistics and Awards */}
      <div className="flex w-full justify-end">
        <div className="text-sm flex gap-2 items-center">
          {/* TODO 小屏幕自动换行 */}
          <div>177 认同</div>
          <div>14 Comments</div>
          <div>190 funny</div>
          {/* Open a new line to show Awards */}
        </div>
        <div className="ml-4">
          <Tooltip title="Funny">
            <IconButton size="medium">
              <SentimentSatisfiedAlt style={{fontSize: '1rem'}} />
            </IconButton>
          </Tooltip>
          <Tooltip title="Award">
            <IconButton size="medium">
              <EmojiEvents style={{fontSize: '1rem'}} />
            </IconButton>
          </Tooltip>
        </div>
      </div>
    </div>
  );
};

export type SingleReviewShowProps = {
  review: ReviewDTO;
  onReply: (reviewId: string) => void;
  onFollow?: () => void;
};

export const SingleReviewShow: React.FC<SingleReviewShowProps> = ({
  review,
  onReply,
  onFollow,
}) => {
  return (
    <div>
      <Box key={review.unitId}>
        <Box sx={{mt: 2}}>
          <CollapsibleReview
            review={review}
            contentClassName="leading-6"
            header={<ReviewHeader review={review} onFollow={onFollow} />}
            footer={<ReviewFooter review={review} onReply={onReply} />}
          />
        </Box>
      </Box>
    </div>
  );
};

export type SingleReviewContainerProps = {
  review: ReviewDTO;
  handleReply: (reviewId: string) => void;
};

export const SingleReviewContainer: React.FC<SingleReviewContainerProps> = ({
  review,
  handleReply,
}) => {
  const handleFollow = () => {
    console.log('Follow clicked for user:', review.user?.name ?? '');
  };

  return (
    <SingleReviewShow
      review={review}
      onReply={handleReply}
      onFollow={handleFollow}
    />
  );
};
