import React, { useMemo } from "react";
import { Box, Avatar, Typography, Button, Divider, Rating } from "@mui/material";
import { proxy, useSnapshot } from "valtio";
import { gql, useQuery } from "urql";
import { CollapsibleText } from "@component/Common/CollapsibleText";
import { ReactionBar } from "@component/Common/ReactionBar";
import FullScreenModal from "../Common/FullScreenModal";
import TreeReplyComponents from "../Form/TreeReplyComponents";

const GET_BOOK_REVIEWS = gql`
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

interface BookReviewsState {
    reviews: any[];
    isReplyModalOpen: boolean;
}

export const BookReviews: React.FC<BookReviewsProps> = ({ bookId }) => {
    const state = useMemo(() => proxy({ reviews: [], isReplyModalOpen: false } as BookReviewsState | any), []);

    const [result] = useQuery({
        query: GET_BOOK_REVIEWS,
        variables: { bookId },
        pause: !bookId,
    });

    state.reviews = result.data?.bookReviews || [];
    const snap = useSnapshot(state);

    React.useEffect(() => {
        if (result.data?.bookReviews) {
            state.reviews = result.data.bookReviews;
        }
    }, [result.data]);

    return (
        <>
            <Box>
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {snap.reviews.map((review: any) => (
                    <Box key={review.id}>
                        <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
                            <Avatar src={review.user.avatar} sx={{ width: 40, height: 40, borderRadius: 1 }} />
                            <Box sx={{ ml: 2 }}>
                                <Typography variant="subtitle1" fontWeight="bold">
                                    {review.user.name}
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    {review.createdAt}
                                </Typography>
                            </Box>
                            <Button variant="outlined" size="small" sx={{ ml: 2, py: 0.5 }}>
                                Follow
                            </Button>
                            <Box sx={{ ml: "auto", textAlign: "right" }}>
                                <Rating defaultValue={review.rating} precision={0.5} />
                                <Typography variant="body2" color="text.secondary">
                                    {990} reviews {1232} followers
                                </Typography>
                            </Box>
                        </Box>

                        <Box sx={{ mt: 2 }}>
                            <CollapsibleText content={review.content} threshold={300} />
                        </Box>

                        <Box className="w-full flex justify-end">
                            <Box sx={{ width: { xs: "100%", sm: "75%", md: "50%", lg: "50%", xl: "33.33%" } }}>
                                <ReactionBar
                                    onReply={() => {
                                        state.isReplyModalOpen = true;
                                    }}
                                />
                            </Box>
                        </Box>

                        <Divider sx={{ my: 2 }} />
                    </Box>
                ))}
            </Box>

            <FullScreenModal
                open={snap.isReplyModalOpen}
                onClose={() => {
                    state.isReplyModalOpen = false;
                }}
                title="回复"
            >
                <Box>
                    <TreeReplyComponents bookListId={bookId} />
                </Box>
            </FullScreenModal>
        </>
    );
};
