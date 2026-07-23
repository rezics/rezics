import { notFound } from "next/navigation";

import { SearchPage } from "@/features/search/search-page";
import { isUuid } from "@/features/slugs/resolve-public-slug.server";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
	const { id } = await params;
	if (!isUuid(id)) notFound();
	return <SearchPage sharedQueryId={id} />;
}
