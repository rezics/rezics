import { useParams } from "wouter";

import { ReviewList } from "@/component/Review/ReviewList";
import { useTranslation } from "react-i18next";
import { useEffect, useState } from "react";
import { GET_BOOK_REVIEWS } from "@/api/bookReviews";
import { useQuery } from "urql";
import { AccentBarWithText } from "@/component/Common/AccentBar";
import { ReviewEdit } from "@/component/Review/ReviewEdit";

export function ReviewByBookPage() {
    const params = useParams();
    const bookId = params[0];
    const { t } = useTranslation();

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
