import { BookReview } from "@/api/bookReviews";
import { SingleReview } from "./SingleReview";

import React, { useMemo } from "react";
import { Box } from "@mui/material";
import { proxy, useSnapshot } from "valtio";
import { gql, useQuery } from "urql";
import FullScreenModal from "../Common/FullScreenModal";
import TreeReplyComponents from "../Form/TreeReplyComponents";

interface BookReviewsState {
    reviews: any[];
    isReplyModalOpen: boolean;
    currentReplyId: string | null;
}

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
        const state = useMemo(
            () => proxy({ reviews: [], isReplyModalOpen: false, currentReplyId: null } as BookReviewsState | any),
            [],
        );

        const handleReply = (reviewId: string) => {
            state.isReplyModalOpen = true;
            state.currentReplyId = reviewId;
        };

        const handleCloseReplyModal = () => {
            state.isReplyModalOpen = false;
            state.currentReplyId = null;
        };

        state.reviews = reviews || [];
        const snap = useSnapshot(state);

        React.useEffect(() => {
            if (reviews) {
                state.reviews = reviews;
            }
        }, [reviews]);

        return (
            <Show
                reviews={snap.reviews}
                isReplyModalOpen={snap.isReplyModalOpen}
                currentReplyId={snap.currentReplyId}
                onReply={handleReply}
                onCloseReplyModal={handleCloseReplyModal}
            />
        );
    };
}
