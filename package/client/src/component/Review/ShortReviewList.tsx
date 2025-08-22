import { BookReview } from "@/api/bookReviews";
import { Stack } from "@mui/material";
import React from "react";
import { SingleShortBookReview } from "./SingleShortBookReview";

export namespace ShortReviewList {
	export type Show = {
		reviews: Array<
			BookReview & {
				likes?: number;
				dislikes?: number;
			}
		>;
		onLike?: (reviewId: string) => void;
		onDislike?: (reviewId: string) => void;
		spacing?: number | string;
	};

	export const Show: React.FC<Show> = (
		{ reviews, onLike, onDislike, spacing = 2 },
	) => {
		// TODO Support useState
		// const [loading, setLoading] = useState(false);
		// const [error, setError] = useState<string | null>(null);

		return (
			<Stack spacing={spacing}>
				{reviews.map((review) => (
					<SingleShortBookReview.Show
						key={review.id}
						review={review}
						onLike={onLike}
						onDislike={onDislike}
					/>
				))}
			</Stack>
		);
	};
}
