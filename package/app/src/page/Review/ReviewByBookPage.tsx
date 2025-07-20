import { useParams } from "wouter";

import { ReviewList } from "@/component/Review/ReviewList";
import { useTranslation } from "react-i18next";
import { useEffect, useState } from "react";
import { AccentBarWithText } from "@/component/Common/AccentBar";
import { ReviewEdit } from "@/component/Review/ReviewEdit";
import tsr from "@/api/tsr";
import { BookReview } from "contract";

export function ReviewByBookPage() {
    const params = useParams();
    const bookId = params[0];
    const { t } = useTranslation();

    const [reviews, setReviews] = useState<BookReview[]>([]);

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
