import { useParams } from "wouter";

import { apiPost } from "@/api/swr.ts";
import { AccentBarWithText } from "@/component/Common/AccentBar.tsx";
import { ReviewEdit } from "@/component/Review/ReviewEdit.tsx";
import { ReviewList } from "@/component/Review/ReviewList.tsx";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import useSWR from "swr";
// import { BookReview } from "contract/schema";

type BookReview = any;

export function ReviewByBookPage() {
    const params = useParams();
    const bookId = params[0];
    const { t } = useTranslation();

    const [reviews, setReviews] = useState<BookReview[]>([]);

    const createReviewListInput = {
        operation: "review.listReviews",
        parameter: {
            bookId: bookId || "",
        },
    };
    const { data, isLoading, error } = useSWR(createReviewListInput, apiPost);

    useEffect(() => {
        if (data?.reviews) {
            setReviews(data.reviews);
        }
    }, [data]);

    return (
        <div className="w-11/12 mx-auto mt-10">
            <AccentBarWithText.Show text={`${t("pages.review_page")}`} />
            <div className="mt-4">
                <ReviewEdit />

                <ReviewList.Show
                    reviews={reviews}
                    isReplyModalOpen={false}
                    currentReplyId={null}
                    onReply={() => {}}
                    onCloseReplyModal={() => {}}
                />
            </div>
        </div>
    );
}
