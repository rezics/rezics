import { useParams } from "wouter";
import { useQuery } from "urql";
import { GET_BOOK_SHORT_REVIEWS } from "@/api/bookReviews";
import { ShortReviewList } from "@/component/Review/ShortReviewList";
import { AccentBarWithText } from "@/component/Common/AccentBar";
import { ReviewEdit } from "@/component/Review/ReviewEdit";

export function ShortReviewByBookPage() {
    const { bookId } = useParams();
    const [result] = useQuery({
        query: GET_BOOK_SHORT_REVIEWS,
        variables: { bookId },
    });

    return (
        <div className="w-10/12 mx-auto mt-10">
            <AccentBarWithText.Show text="短评" />
            <div className="mt-4">
                <ReviewEdit />
                <ShortReviewList.Show reviews={result.data?.bookShortReviews ?? []} />
            </div>
        </div>
    );
}
