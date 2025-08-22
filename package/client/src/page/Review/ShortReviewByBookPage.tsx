import { apiPost } from "@/api/swr.ts";
import { AccentBarWithTextShow } from "@/component/Common/AccentBar.tsx";
import { ReviewEdit } from "@/component/Review/ReviewEdit.tsx";
import { ShortReviewList } from "@/component/Review/ShortReviewList.tsx";
import useSWR from "swr";
import { useParams } from "wouter";

export function ShortReviewByBookPage() {
	const { bookId } = useParams();
	const createShortReviewListInput = {
		operation: "review.short.list",
		parameter: {
			bookId: bookId || "",
		},
	};
	const { data, isLoading, error } = useSWR(
		createShortReviewListInput,
		apiPost,
	);

	return (
		<div className="w-10/12 mx-auto mt-10">
			<AccentBarWithTextShow text="短评" />
			<div className="mt-4">
				<ReviewEdit />
				<ShortReviewList.Show reviews={data ?? [] as any} />
			</div>
		</div>
	);
}
