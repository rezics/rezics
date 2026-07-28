import { WikiCreatePage } from "@/features/posts/pages/wiki-create-page";
import { postCreateSearchParams } from "@/lib/search-params.server";

export default async function Page({
	searchParams,
}: {
	searchParams: Promise<{ realmId?: string | string[] }>;
}) {
	const { realmId } = await postCreateSearchParams.parse(searchParams);
	return <WikiCreatePage defaultRealmId={realmId ?? undefined} />;
}
