import { PostRevisionComparePage } from "@/features/posts/post-history";

export default async function Page({
	params,
	searchParams,
}: {
	params: Promise<{ id: string }>;
	searchParams: Promise<{ from?: string; to?: string }>;
}) {
	const [{ id }, query] = await Promise.all([params, searchParams]);
	return <PostRevisionComparePage postId={id} from={query.from ?? ""} to={query.to ?? ""} />;
}
