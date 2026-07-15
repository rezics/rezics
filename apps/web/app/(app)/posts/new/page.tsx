import { PostCreatePage } from "@/features/posts/post-pages";

export default async function Page({
	searchParams,
}: {
	searchParams: Promise<{ realmId?: string | string[] }>;
}) {
	const realmId = (await searchParams).realmId;
	return <PostCreatePage defaultRealmId={typeof realmId === "string" ? realmId : undefined} />;
}
