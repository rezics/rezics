import React, { useEffect, useState } from "react";
import { ShortReviewList } from "../Review/ShortReviewList";
import { tsr } from "@/api/tsr";
import { BookReview } from "contract";

type Review = BookReview & {
    likes?: number;
    dislikes?: number;
};

interface ShortBookReviewsProps {
    bookId: string;
}

export const ShortBookReviews: React.FC<ShortBookReviewsProps> = ({ bookId }) => {
    const { data, isLoading, error } = tsr.review.listShortReviews.useQuery({
        queryKey: ["shortBookReviews", bookId],
        queryData: {
            params: {
                bookId: bookId || "",
            },
        },
    });

    const reviews = data?.body ?? [];

    const handleLike = (reviewId: string) => {
        console.log("Like review:", reviewId);
    };

    const handleDislike = (reviewId: string) => {
        console.log("Dislike review:", reviewId);
    };

    return <ShortReviewList.Show reviews={reviews} onLike={handleLike} onDislike={handleDislike} />;
};
