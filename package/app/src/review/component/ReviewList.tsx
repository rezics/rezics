import {type ReviewDTO} from '@package/contract';
import {SingleReviewShow} from './SingleReview';

import {Box} from '@mui/material';
import React, {useEffect, useReducer} from 'react';

export type ReviewListProps = {
  reviews: ReviewDTO[];
};

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

export const ReviewList: React.FC<ReviewListProps> = ({reviews}) => {
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
    <Box>
      {state.reviews.map(review => (
        <SingleReviewShow
          key={review.unitId}
          review={review}
          onReply={handleReply}
        />
      ))}

      {/* 
      <ReplyModal
        open={state.isReplyModalOpen}
        reviewId={state.currentReplyId}
        onClose={handleCloseReplyModal}
      />
      */}
    </Box>
  );
};
