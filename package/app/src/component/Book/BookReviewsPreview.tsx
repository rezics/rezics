import React, { useEffect, useState } from "react";
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

export const BookReviews: React.FC<BookReviewsProps> = ({ bookId }) => {
    const [reviews, setReviews] = useState<any[]>([]);

    const [result] = useQuery({
        query: GET_BOOK_REVIEWS,
        variables: { bookId },
        pause: !bookId,
    });

    useEffect(() => {
        if (result.data?.bookReviews) {
            setReviews(result.data.bookReviews);
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
                <ReviewList.Container reviews={reviews} />
            </Box>
        </>
    );
};
