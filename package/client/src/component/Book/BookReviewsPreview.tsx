import React, { useEffect, useState } from "react";

import { ReviewList } from "../Review/ReviewList";
import { ArrowForwardIcon } from "../Common/ArrowForwardIcon";
import { Box } from "@mui/material";
import { AccentBarWithText } from "../Common/AccentBar";
import tsr from "@/api/tsr";

interface BookReviewsProps {
    bookId: string;
    title: string;
}

export const BookReviews: React.FC<BookReviewsProps> = ({ bookId, title }) => {
    const [reviews, setReviews] = useState<any[]>([]);

    const { data, isLoading, error } = tsr.review.listReviews.useQuery({
        queryKey: ["review", bookId],
        queryData: {
            params: {
                bookId: bookId || "",
            },
        },
    });

    useEffect(() => {
        if (data?.body) {
            setReviews(data.body);
        }
    }, [data]);

    return (
        <>
            <Box>
                <ArrowForwardIcon.Container
                    size={16}
                    to={`/review/book/${bookId}/`}
                >
                    <AccentBarWithText.Show text={`${title}的书评`} />
                </ArrowForwardIcon.Container>
                <ReviewList.Container reviews={reviews} />
            </Box>
        </>
    );
};
