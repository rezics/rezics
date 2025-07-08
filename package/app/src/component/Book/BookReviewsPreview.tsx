import React, { useMemo } from "react";
import { proxy, useSnapshot } from "valtio";
import { gql, useQuery } from "urql";
import { ReviewList } from "../Review/ReviewList";
import { ArrowForwardIcon } from "../Common/ArrowForwardIcon";
import { Box, Link } from "@mui/material";
import { AccentBarWithText } from "../Common/AccentBar";

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
    title: string;
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
                <Link href={`/book/${bookId}/reviews`} className="flex mb-4">
                    <ArrowForwardIcon.Container size={16}>
                        <AccentBarWithText.Show text={`${bookId}的书评`} />
                    </ArrowForwardIcon.Container>
                </Link>
                <ReviewList.Container reviews={snap.reviews} />
            </Box>
        </>
    );
};
