import { ChapterHistoryComparePage } from "@/features/history/pages/chapter-history-page";

export default async function Page({
	params,
	searchParams,
}: {
	params: Promise<{ unit: string; chapterId: string }>;
	searchParams: Promise<{ from?: string; to?: string }>;
}) {
	const [{ unit, chapterId }, query] = await Promise.all([params, searchParams]);
	return (
		<ChapterHistoryComparePage
			bookId={unit}
			chapterId={chapterId}
			from={query.from ?? null}
			to={query.to ?? null}
		/>
	);
}
