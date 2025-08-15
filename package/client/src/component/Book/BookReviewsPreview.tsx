import React, { useEffect, useState } from "react";

import { ReviewList } from "../Review/ReviewList.tsx";
import { ArrowForwardIcon } from "../Common/ArrowForwardIcon.tsx";
import { Box } from "@mui/material";
import { AccentBarWithText } from "../Common/AccentBar.tsx";
import { apiPost } from "@/api/swr.ts";
import useSWR from "swr";

interface BookReviewsProps {
	bookId: string;
	title: string;
}

export const BookReviews: React.FC<BookReviewsProps> = ({ bookId, title }) => {
	const [reviews, setReviews] = useState<any[]>([]);

	const createBookReviewsInput = {
		operation: "review.list",
		parameter: {
			bookId: bookId || "",
		},
	};
	const { data, isLoading, error } = useSWR(createBookReviewsInput, apiPost);

	useEffect(() => {
		if (data) {
			setReviews(data);
		}
	}, [data]);

	return (
		<>
			<Box>
				<ArrowForwardIcon.Container
					size={16}
					to={`/review/book/${bookId}/`}
				>
					<AccentBarWithText.Show text={`${title}的书评`} />
				</ArrowForwardIcon.Container>
				<ReviewList.Container reviews={reviews} />
			</Box>
		</>
	);
};
