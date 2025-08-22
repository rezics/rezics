import { SingleQuoteExcerpt } from "@component/Review/SingleQuoteExcerpt.tsx";
import { Box, Stack } from "@mui/material";

type QuoteExcerpt = {
	id: string;
	content: string;
	author: {
		name: string;
		avatar: string;
	};
	created_at: string;
} | any;

export namespace QuoteExcerptList {
	export type Show = {
		data: QuoteExcerpt[];
	};

	export const Show: React.FC<Show> = ({ data }) => {
		return (
			<div>
				{/* Quotes */}
				<Box>
					<Stack spacing={2}>
						{(Array.isArray(data) ? data : []).map(
							(quote: QuoteExcerpt) => (
								<SingleQuoteExcerpt.Show
									key={quote.id}
									author={{
										name: quote.author.name,
										avatar: quote.author.avatar || "",
									}}
									content={quote.content}
									stats={{
										replies: 0,
										likes: 0,
										date: quote.created_at,
									}}
									source={"quote.source"}
									originalLink={"quote.originalLink"}
								/>
							),
						)}
					</Stack>
				</Box>
			</div>
		);
	};

	export type Container = {
		data: QuoteExcerpt[];
	};

	export const Container: React.FC<Container> = ({ data }) => {
		return <Show data={data} />;
	};
}
