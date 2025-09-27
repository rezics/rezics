import useRpcQuery from "@/api/swr-query/tsrTypeBuild";
import { AccentBarWithTextShow } from "@/component/Common/AccentBar.tsx";
import { ReviewEdit } from "@/component/Review/ReviewEdit.tsx";
import { ShortReviewListShow } from "@/component/Review/ShortReviewList.tsx";
import { useParams } from "wouter";

export function ShortReviewByBookPage() {
  const { bookId } = useParams();
  const createShortReviewListInput = {
    operation: "review.short.list",
    parameter: {
      bookId: bookId || "",
    },
  };
  const { data, isLoading, error } = useRpcQuery<any[]>(createShortReviewListInput);

  return (
    <div className="w-10/12 mx-auto mt-10">
      <AccentBarWithTextShow text="短评" />
      <div className="mt-4">
        <ReviewEdit />
        <ShortReviewListShow reviews={data ?? ([] as any)} />
      </div>
    </div>
  );
}
