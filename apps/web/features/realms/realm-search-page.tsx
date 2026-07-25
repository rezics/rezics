"use client";

import { toContentLanguage } from "@rezics/i18n";
import { useGetApiRealmsByRealmId } from "@rezics/openapi-tanstack-query";
import { QueryFailure, QueryPending } from "@rezics/ui";
import { useMemo } from "react";

import { useHeaderSearchOverride } from "@/features/application-shell/header-search";
import { ScopedSearchPage } from "@/features/search/search-page";
import { realmHref } from "@/features/slugs/unit-route";
import { useTranslation } from "@/i18n/client";
import { selectLocalization } from "@/lib/localization";

export function RealmSearchPage({ realmId }: { readonly realmId: string }) {
	const { locale, t } = useTranslation(["realms", "search"]);
	const query = useGetApiRealmsByRealmId({
		path: { realmId },
		query: { language: toContentLanguage(locale.target) },
	});
	const headerSearch = useMemo(() => {
		if (!query.data) return undefined;
		const localization = selectLocalization(
			query.data.localizations,
			toContentLanguage(locale.target),
			query.data.language,
		);
		const name = localization?.title ?? t.realms.untitled;
		return {
			href: `${realmHref(query.data)}/search`,
			label: t.search.withinLabel({ name }),
			placeholder: t.search.withinPlaceholder({ name }),
			avatar: query.data.avatar,
			avatarFallback: name.slice(0, 1).toUpperCase(),
		};
	}, [locale.target, query.data, t.realms.untitled, t.search]);
	useHeaderSearchOverride(headerSearch);

	if (query.isPending) return <QueryPending />;
	if (query.isError)
		return <QueryFailure error={query.error} retry={() => void query.refetch()} />;
	return (
		<ScopedSearchPage
			contexts={[{ kind: "realm", realmId }]}
			id={`realm-${realmId}-search`}
			source={{ kind: "template", template: "global" }}
		/>
	);
}
