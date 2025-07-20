import { BookReview } from "@/api/bookReviews";
import { SingleReview } from "./SingleReview";

import React, { useEffect, useReducer } from "react";
import { Box } from "@mui/material";
import FullScreenModal from "../Common/FullScreenModal";
import TreeReplyComponents from "../Form/TreeReplyComponents";

export namespace ReviewList {
    export type Show = {
        reviews: BookReview[];
        isReplyModalOpen: boolean;
        currentReplyId: string | null;
        onReply: (reviewId: string) => void;
        onCloseReplyModal: () => void;
    };

    export const Show: React.FC<Show> = ({ reviews, isReplyModalOpen, currentReplyId, onReply, onCloseReplyModal }) => {
        return (
            <>
                <Box>
                    {reviews.map((review: BookReview) => (
                        <SingleReview.Show key={review.id} review={review} onReply={onReply} />
                    ))}
                </Box>

                <FullScreenModal open={isReplyModalOpen} onClose={onCloseReplyModal} title="回复">
                    <Box>
                        <TreeReplyComponents bookListId={currentReplyId || ""} />
                    </Box>
                </FullScreenModal>
            </>
        );
    };

    export type Container = {
        reviews: BookReview[];
    };

    export const Container: React.FC<Container> = ({ reviews }) => {
        type State = {
            reviews: BookReview[];
            isReplyModalOpen: boolean;
            currentReplyId: string | null;
        };

        type Action =
            | { type: "setReviews"; reviews: BookReview[] }
            | { type: "openReply"; id: string }
            | { type: "closeReply" };

        const reducer = (state: State, action: Action): State => {
            switch (action.type) {
                case "setReviews":
                    return { ...state, reviews: action.reviews };
                case "openReply":
                    return { ...state, isReplyModalOpen: true, currentReplyId: action.id };
                case "closeReply":
                    return { ...state, isReplyModalOpen: false, currentReplyId: null };
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
            dispatch({ type: "setReviews", reviews: reviews || [] });
        }, [reviews]);

        const handleReply = (reviewId: string) => {
            dispatch({ type: "openReply", id: reviewId });
        };

        const handleCloseReplyModal = () => {
            dispatch({ type: "closeReply" });
        };

        return (
            <Show
                reviews={state.reviews}
                isReplyModalOpen={state.isReplyModalOpen}
                currentReplyId={state.currentReplyId}
                onReply={handleReply}
                onCloseReplyModal={handleCloseReplyModal}
            />
        );
    };
}
