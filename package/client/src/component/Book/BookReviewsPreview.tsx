import React, { useEffect, useState } from "react";

import { apiPost } from "@/api/swr.ts";
import { Box } from "@mui/material";
import useSWR from "swr";
import { AccentBarWithTextShow } from "../Common/AccentBar.tsx";
import { ArrowForwardIconContainer } from "../Common/ArrowForwardIcon.tsx";
import { ReviewList } from "../Review/ReviewList.tsx";

interface BookReviewsProps {
    bookId: string;
    title: string;
}

export const BookReviews: React.FC<BookReviewsProps> = ({ bookId, title }) => {
    const [reviews, setReviews] = useState<any[]>([]);

    const createBookReviewsInput = {
        operation: "review.list",
        parameter: {
            bookId: bookId || "",
        },
    };
    const { data, isLoading, error } = useSWR(createBookReviewsInput, apiPost);

    useEffect(() => {
        if (data) {
            setReviews(data);
        }
    }, [data]);

    return (
        <>
            <Box>
                <ArrowForwardIconContainer
                    size={16}
                    to={`/review/book/${bookId}/`}
                >
                    <AccentBarWithTextShow text={`${title}的书评`} />
                </ArrowForwardIconContainer>
                <ReviewList.Container reviews={reviews} />
            </Box>
        </>
    );
};
