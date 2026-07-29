import { PostDetailPage } from "@/features/posts/pages/post-detail-page";
import { postDetailSearchParams } from "@/lib/search-params.server";

export default async function Page({
	params,
	searchParams,
}: {
	params: Promise<{ id: string }>;
	searchParams: Promise<{ realmId?: string | string[]; from?: string | string[] }>;
}) {
	const [{ id }, { from, realmId }] = await Promise.all([
		params,
		postDetailSearchParams.parse(searchParams),
	]);
	return (
		<PostDetailPage
			context={realmId ? { kind: "realm", realmId } : undefined}
			id={id}
			returnToDiscussion={from === "discussion"}
		/>
	);
}
