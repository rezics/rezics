import { PostRevisionComparePage } from "@/features/posts/post-history";
import { historyCompareSearchParams } from "@/lib/search-params.server";

export default async function Page({
	params,
	searchParams,
}: {
	params: Promise<{ id: string }>;
	searchParams: Promise<{ from?: string; to?: string }>;
}) {
	const [{ id }, query] = await Promise.all([
		params,
		historyCompareSearchParams.parse(searchParams),
	]);
	return <PostRevisionComparePage postId={id} from={query.from} to={query.to} />;
}
