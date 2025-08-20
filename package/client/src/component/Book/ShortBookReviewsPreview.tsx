import { apiPost } from "@/api/swr.ts";
import React, { useEffect, useState } from "react";
import useSWR from "swr";
import { ShortReviewList } from "../Review/ShortReviewList.tsx";

type Review = {
    likes?: number;
    dislikes?: number;
};

interface ShortBookReviewsProps {
    bookId: string;
}

export const ShortBookReviews: React.FC<ShortBookReviewsProps> = ({
    bookId,
}) => {
    const createBookInput = {
        operation: "review.short.list",
        parameter: { bookId: bookId },
        select: {
            id: true,
        },
    };
    const { data, isLoading, error } = useSWR(createBookInput, apiPost);

    const reviews = data || [];

    const handleLike = (reviewId: string) => {
        console.log("Like review:", reviewId);
    };

    const handleDislike = (reviewId: string) => {
        console.log("Dislike review:", reviewId);
    };

    return (
        <ShortReviewList.Show
            reviews={reviews}
            onLike={handleLike}
            onDislike={handleDislike}
        />
    );
};
