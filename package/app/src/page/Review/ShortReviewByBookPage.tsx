import { useParams } from "wouter";
import { ShortReviewList } from "@/component/Review/ShortReviewList";
import { AccentBarWithText } from "@/component/Common/AccentBar";
import { ReviewEdit } from "@/component/Review/ReviewEdit";
import tsr from "@/api/tsr";

export function ShortReviewByBookPage() {
    const { bookId } = useParams();
    const { data, isLoading, error } = tsr.review.listShortReviews.useQuery({
        queryKey: ["review", bookId],
        queryData: {
            params: {
                bookId: bookId || "",
            },
        },
    });

    return (
        <div className="w-10/12 mx-auto mt-10">
            <AccentBarWithText.Show text="短评" />
            <div className="mt-4">
                <ReviewEdit />
                <ShortReviewList.Show reviews={data?.body ?? []} />
            </div>
        </div>
    );
}
