import { notFound } from "next/navigation";

import { parsePublicEntrySearchSubject } from "@/features/catalog/model/public-entry-search";
import { PublicEntrySearchPage } from "@/features/create/pages/public-entry-search-page";

export default async function Page({
	params,
	searchParams,
}: {
	readonly params: Promise<{ section: string }>;
	readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
	const [{ section }, route] = await Promise.all([params, searchParams]);
	const kind = typeof route.kind === "string" ? route.kind : undefined;
	const query = typeof route.q === "string" ? route.q : "";
	const subject = parsePublicEntrySearchSubject(section, kind);
	if (!subject) notFound();
	return <PublicEntrySearchPage initialQuery={query} subject={subject} />;
}
