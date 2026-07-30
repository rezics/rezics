import { notFound } from "next/navigation";

import { parseCommunityUnitSearchSubject } from "@/features/create/model/community-unit-search";
import { CommunityUnitSearchPage } from "@/features/create/pages/community-unit-search-page";
import { loadTagCreateRoute } from "@/features/tags/routing/tag-create-route";

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
	const subject = parseCommunityUnitSearchSubject(section, kind);
	if (!subject) notFound();
	const tagCreateRoute = subject.kind === "tag" ? await loadTagCreateRoute(route) : null;
	if (tagCreateRoute?.status === "invalid") notFound();
	return (
		<CommunityUnitSearchPage
			initialQuery={query}
			subject={subject}
			unitTagVoteTarget={
				tagCreateRoute?.status === "ready" && tagCreateRoute.intent.kind === "unit-tag-vote"
					? tagCreateRoute.intent
					: undefined
			}
		/>
	);
}
