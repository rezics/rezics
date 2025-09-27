import { useParams } from "wouter";

import useRpcQuery from "@/api/swr-query/tsrTypeBuild";
import { AccentBarWithTextShow } from "@/component/Common/AccentBar.tsx";
import { ReviewEdit } from "@/component/Review/ReviewEdit.tsx";
import { ReviewList } from "@/component/Review/ReviewList.tsx";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
// import { BookReview } from "contract/schema";

type BookReview = any;

export function ReviewByBookPage() {
  const params = useParams();
  const bookId = params[0];
  const { t } = useTranslation();

  const [reviews, setReviews] = useState<BookReview[]>([]);

  const createReviewListInput = {
    operation: "review.list",
    parameter: {
      bookId: bookId || "",
    },
  };
  const { data, isLoading, error } = useRpcQuery<any[]>(createReviewListInput);

  useEffect(() => {
    if (data) {
      setReviews(data as any);
    }
  }, [data]);

  return (
    <div className="w-11/12 mx-auto mt-10">
      <AccentBarWithTextShow text={`${t("pages.review_page")}`} />
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
