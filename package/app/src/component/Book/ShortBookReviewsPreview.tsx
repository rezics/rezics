import React, { useEffect, useState } from "react";
import { ShortReviewList } from "../Review/ShortReviewList";
import { BookReview, GET_BOOK_SHORT_REVIEWS } from "@/api/bookReviews";
import { useQuery } from "urql";


type Review = BookReview & {
    likes?: number;
    dislikes?: number;
};

interface ShortBookReviewsProps {
    bookId: string;
}

export const ShortBookReviews: React.FC<ShortBookReviewsProps> = ({ bookId }) => {
    const [result] = useQuery({
        query: GET_BOOK_SHORT_REVIEWS,
        variables: { bookId },
    });

    const reviews = result.data?.bookShortReviews ?? [];

    const handleLike = (reviewId: string) => {
        console.log("Like review:", reviewId);
    };

    const handleDislike = (reviewId: string) => {
        console.log("Dislike review:", reviewId);
    };

    return <ShortReviewList.Show reviews={reviews} onLike={handleLike} onDislike={handleDislike} />;
};
