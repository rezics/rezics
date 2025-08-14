import { useParams } from "wouter";
import { ShortReviewList } from "@/component/Review/ShortReviewList.tsx";
import { AccentBarWithText } from "@/component/Common/AccentBar.tsx";
import { ReviewEdit } from "@/component/Review/ReviewEdit.tsx";
import { apiPost } from "@/api/swr.ts";
import useSWR from "swr";

export function ShortReviewByBookPage() {
    const { bookId } = useParams();
    const createShortReviewListInput = {
        operation: "review.listShortReviews",
        parameter: {
            bookId: bookId || "",
        },
    };
    const { data, isLoading, error } = useSWR(createShortReviewListInput, apiPost);

    return (
        <div className="w-10/12 mx-auto mt-10">
            <AccentBarWithText.Show text="短评" />
            <div className="mt-4">
                <ReviewEdit />
                <ShortReviewList.Show reviews={data ?? []} />
            </div>
        </div>
    );
}
