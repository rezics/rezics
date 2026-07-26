import { PostHistoryComparePage } from "@/features/posts/pages/post-history-compare-page";
import { historyCompareSearchParams } from "@/lib/search-params.server";

export default async function Page({
	searchParams,
}: {
	searchParams: Promise<{ from?: string; to?: string }>;
}) {
	const query = await historyCompareSearchParams.parse(searchParams);
	return <PostHistoryComparePage from={query.from} to={query.to} />;
}
