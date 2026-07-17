import { PostCreatePage } from "@/features/posts/post-pages";
import { postCreateSearchParams } from "@/lib/search-params.server";

export default async function Page({
	searchParams,
}: {
	searchParams: Promise<{ realmId?: string | string[] }>;
}) {
	const { realmId } = await postCreateSearchParams.parse(searchParams);
	return <PostCreatePage defaultRealmId={realmId ?? undefined} />;
}
