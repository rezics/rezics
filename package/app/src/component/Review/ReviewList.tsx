import {type ReviewDTO} from '@package/contract';
import {SingleReviewShow} from './SingleReview';

import {Box, Button} from '@mui/material';
import React, {useEffect, useReducer} from 'react';

export type ReviewListShowProps = {
  reviews: ReviewDTO[];
  isReplyModalOpen: boolean;
  currentReplyId: string | null;
  onReply: (reviewId: string) => void;
  onCloseReplyModal: () => void;
};

export const ReviewListShow: React.FC<ReviewListShowProps> = ({
  reviews,
  onReply,
}) => {
  return (
    <Box>
      {reviews.map((review: ReviewDTO) => (
        <SingleReviewShow
          key={review.unitId}
          review={review}
          onReply={onReply}
        />
      ))}
    </Box>
  );
};

export type ReviewListContainerProps = {
  reviews: ReviewDTO[];
};

export const ReviewListContainer: React.FC<ReviewListContainerProps> = ({
  reviews,
}) => {
  type State = {
    reviews: ReviewDTO[];
    isReplyModalOpen: boolean;
    currentReplyId: string | null;
  };

  type Action =
    | {type: 'setReviews'; reviews: ReviewDTO[]}
    | {type: 'openReply'; id: string}
    | {type: 'closeReply'};

  const reducer = (state: State, action: Action): State => {
    switch (action.type) {
      case 'setReviews':
        return {...state, reviews: action.reviews};
      case 'openReply':
        return {
          ...state,
          isReplyModalOpen: true,
          currentReplyId: action.id,
        };
      case 'closeReply':
        return {
          ...state,
          isReplyModalOpen: false,
          currentReplyId: null,
        };
      default:
        return state;
    }
  };

  const [state, dispatch] = useReducer(reducer, {
    reviews: [],
    isReplyModalOpen: false,
    currentReplyId: null,
  });

  useEffect(() => {
    dispatch({type: 'setReviews', reviews: reviews || []});
  }, [reviews]);

  const handleReply = (reviewId: string) => {
    dispatch({type: 'openReply', id: reviewId});
  };

  const handleCloseReplyModal = () => {
    dispatch({type: 'closeReply'});
  };

  return (
    <ReviewListShow
      reviews={state.reviews}
      isReplyModalOpen={state.isReplyModalOpen}
      currentReplyId={state.currentReplyId}
      onReply={handleReply}
      onCloseReplyModal={handleCloseReplyModal}
    />
  );
};
