import { BookReview } from "@/graphql/bookReviews";
import { SingleReview } from "./SingleReview";

import React, { useMemo } from "react";
import { Box, Avatar, Typography, Button, Divider, Rating } from "@mui/material";
import { proxy, useSnapshot } from "valtio";
import { gql, useQuery } from "urql";
import { CollapsibleText } from "@component/Common/CollapsibleText";
import { ReactionBar } from "@component/Common/ReactionBar";
import FullScreenModal from "../Common/FullScreenModal";
import TreeReplyComponents from "../Form/TreeReplyComponents";

interface BookReviewsProps {
    bookId: string;
}

interface BookReviewsState {
    reviews: any[];
    isReplyModalOpen: boolean;
    currentReplyId: string | null;
}

export function ReviewList({ reviews }: { reviews: BookReview[] }) {

    const state = useMemo(() => proxy({ reviews: [], isReplyModalOpen: false, currentReplyId: null } as BookReviewsState | any), []);

    function handleReply(reviewId: string) {
        state.isReplyModalOpen = true;
        state.currentReplyId = reviewId;
    }

    // const [result] = useQuery({
    //     query: GET_BOOK_REVIEWS,
    //     variables: { bookId },
    //     pause: !bookId,
    // });

    state.reviews = reviews || [];
    const snap = useSnapshot(state);

    React.useEffect(() => {
        if (reviews) {
            state.reviews = reviews;
        }
    }, [reviews]);

    return (
        <>
            <Box>
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {snap.reviews.map((review: BookReview) => (
                    <SingleReview key={review.id} review={review} handleReply={handleReply} />
                ))}
            </Box>

            <FullScreenModal
                open={snap.isReplyModalOpen}
                onClose={() => {
                    state.isReplyModalOpen = false;
                    state.currentReplyId = null;
                }}
                title="回复"
            >
                <Box>
                    <TreeReplyComponents bookListId={snap.currentReplyId || ""} />
                </Box>
            </FullScreenModal>
        </>
    );
}
