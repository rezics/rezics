import React, { useEffect, useState } from "react";

import { ReviewList } from "../Review/ReviewList";
import { ArrowForwardIcon } from "../Common/ArrowForwardIcon";
import { Box } from "@mui/material";
import { Link } from "wouter";
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
                <Link href={`/review/book/${bookId}/`} className="flex mb-4">
                    <ArrowForwardIcon.Container size={16}>
                        <AccentBarWithText.Show text={`${title}的书评`} />
                    </ArrowForwardIcon.Container>
                </Link>
                <ReviewList.Container reviews={reviews} />
            </Box>
        </>
    );
};
