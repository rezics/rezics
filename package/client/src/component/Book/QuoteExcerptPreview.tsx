import { apiPost } from "@/api/swr.ts";
import { isEmptyValue } from "@/util/dataCheck.ts";
import useSWR from "swr";
import { QuoteExcerptList } from "../Review/QuoteExcerptList.tsx";

interface QuoteExcerpt {
	id: string;
	content: string;
	author: string;
	createdAt: string;
	updatedAt: string;
}

export namespace QuoteExcerptPreview {
	export type Show = {
		id?: string;
		data: QuoteExcerpt[];
		isLoading: boolean;
		error?: string;
	};

	export const Show: React.FC<Show> = ({ data, isLoading, error }) => {
		if (isLoading) return <div>Loading...</div>;
		if (error && !isEmptyValue(error)) return <div>Oh no... {error}</div>;

		return (
			<div>
				<QuoteExcerptList.Container data={data || []} />
			</div>
		);
	};

	export type Container = {
		id: string;
	};

	export const Container: React.FC<Container> = ({ id }) => {
		const createBookInput = {
			operation: "review.quote.list",
			parameter: { bookId: id },
			select: {
				id: true,
				content: true,
				author: true,
				createdAt: true,
				updatedAt: true,
			},
		};

		const { data, isLoading, error } = useSWR(createBookInput, apiPost);

		const quote = data || [];
		return (
			<Show
				data={quote}
				isLoading={isLoading}
				error={String(error)}
			/>
		);
	};
}
