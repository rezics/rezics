import {ReactionBar} from '@/component/Common/Reaction/ReactionBar';
import {Avatar, Box, Button, Rating, Tooltip, Typography} from '@mui/material';
import {Link} from 'wouter';
import {type ReviewDTO} from '@package/contract';
import React from 'react';
import {CollapsibleReview} from '@/component/ReadList/Review';
import {parseReactionSummaries} from '@/util/reactionSummariesParser';
import {ReactionStatistics} from '../Common/Reaction/ReactionStatistics';

export const ReviewHeader: React.FC<{
  review: ReviewDTO;
  onFollow?: () => void;
}> = ({review, onFollow}) => {
  return (
    <div className="flex flex-wrap items-center mb-2 gap-2">
      {/* Avatar */}
      <Avatar src={review.user?.avatar ?? ''} variant="rounded" />

      {/* User Info */}
      <div className="ml-2">
        <Typography variant="subtitle1" fontWeight="bold">
          {review.user?.name}
        </Typography>

        <Typography variant="body2" color="text.secondary">
          {/* {990} reviews · {1232} followers */}
          {1232} followers
        </Typography>
      </div>

      {/* Follow Button */}
      <Button
        variant="outlined"
        size="small"
        sx={{py: 0.5}}
        className="!ml-2"
        onClick={onFollow}
      >
        Follow
      </Button>

      {/* Rating + Time (push to right, but wrap under on small screens) */}
      <div className="ml-auto text-right min-w-[120px]">
        <Tooltip title={`打开书评页面`} placement="top-end">
          <Link href={`/review/${review.unitId}`}>
            <div>
              <Rating defaultValue={review.rating} precision={0.5} readOnly />
              <Typography variant="body2" color="text.secondary">
                {review.created_at}
              </Typography>
            </div>
          </Link>
        </Tooltip>
      </div>
    </div>
  );
};

const ReviewFooter: React.FC<{
  review: ReviewDTO;
  onReply: (reviewId: string) => void;
}> = ({review, onReply}) => {
  const reactionSummaries = parseReactionSummaries(
    review.reactionSummaries ?? [],
  );
  return (
    <div className="w-full flex flex-wrap justify-between items-center gap-2">
      {/* Left: Reaction stats */}
      <div className="ml-2">
        <ReactionStatistics reactionSummaries={reactionSummaries} />
      </div>

      {/* Right: ReactionBar */}
      <div className="flex justify-end">
        <ReactionBar
          unitId={review.unitId}
          onReply={() => onReply(review.unitId)}
          itemUrl={`/review/${review.unitId}`}
          hideReply={true}
          hideLike={true}
          hideDislike={true}
        />
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
