import { Box } from "@mui/material";
import type { PostDTO } from "@rezics/contract";
import type React from "react";
import { useEffect, useReducer } from "react";
import { SingleReviewShow } from "./SingleReview";

/**
 * ReviewList - now uses PostDTO instead of ReviewDTO.
 * Posts with kindKey='review' are rendered as reviews.
 */
export type ReviewListProps = {
  reviews: PostDTO[];
};

type State = {
  reviews: PostDTO[];
  isReplyModalOpen: boolean;
  currentReplyId: string | null;
};

type Action =
  | { type: "setReviews"; reviews: PostDTO[] }
  | { type: "openReply"; id: string }
  | { type: "closeReply" };

const reducer = (state: State, action: Action): State => {
  switch (action.type) {
    case "setReviews":
      return { ...state, reviews: action.reviews };

    case "openReply":
      return {
        ...state,
        isReplyModalOpen: true,
        currentReplyId: action.id,
      };

    case "closeReply":
      return {
        ...state,
        isReplyModalOpen: false,
        currentReplyId: null,
      };

    default:
      return state;
  }
};

export const ReviewList: React.FC<ReviewListProps> = ({ reviews }) => {
  const [state, dispatch] = useReducer(reducer, {
    reviews: [],
    isReplyModalOpen: false,
    currentReplyId: null,
  });

  useEffect(() => {
    dispatch({ type: "setReviews", reviews: reviews || [] });
  }, [reviews]);

  const handleReply = (reviewId: string) => {
    dispatch({ type: "openReply", id: reviewId });
  };

  const _handleCloseReplyModal = () => {
    dispatch({ type: "closeReply" });
  };

  return (
    <Box>
      {state.reviews.map((review) => (
        <SingleReviewShow
          key={review.unitId}
          review={review}
          onReply={handleReply}
        />
      ))}
    </Box>
  );
};
