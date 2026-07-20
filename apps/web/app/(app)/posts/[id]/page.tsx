import { PostDetailPage } from "@/features/posts/post-pages";
import { postDetailSearchParams } from "@/lib/search-params.server";

export default async function Page({
	params,
	searchParams,
}: {
	params: Promise<{ id: string }>;
	searchParams: Promise<{ realmId?: string | string[] }>;
}) {
	const [{ id }, { realmId }] = await Promise.all([
		params,
		postDetailSearchParams.parse(searchParams),
	]);
	return <PostDetailPage id={id} realmId={realmId ?? undefined} />;
}
