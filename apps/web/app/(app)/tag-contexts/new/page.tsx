import { notFound } from "next/navigation";

import { RealmTagContextCreatePage } from "@/features/realms/pages/realm-tag-context-create-page";
import { postCreateSearchParams } from "@/lib/search-params.server";

export default async function Page({
	searchParams,
}: {
	searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
	const { realmId } = await postCreateSearchParams.parse(searchParams);
	if (!realmId) notFound();
	return <RealmTagContextCreatePage realmId={realmId} />;
}
