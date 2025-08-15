import { apiPost } from "@/api/swr.ts";
import { AccentBarWithText } from "@/component/Common/AccentBar.tsx";
import useSWR from "swr";

interface TagByBookPageProps {
	bookId: string;
}

export function TagByBookPage({ bookId }: TagByBookPageProps) {
	const createBookInfoInput = {
		operation: "book.read",
		parameter: {
			bookId: bookId || "",
		},
	};
	const { data, isLoading, error } = useSWR(createBookInfoInput, apiPost);

	return (
		<div className="w-11/12 mx-auto mt-10">
			<AccentBarWithText.Show text={`${data.title} 的标签`} />
		</div>
	);
}
