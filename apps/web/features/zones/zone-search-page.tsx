"use client";

import { toContentLanguage } from "@rezics/i18n";
import { useGetZoneRenderProjection } from "@rezics/openapi-tanstack-query";
import { QueryFailure, QueryPending } from "@rezics/ui";
import { useMemo } from "react";

import { useHeaderSearchOverride } from "@/features/application-shell/header-search";
import { ScopedSearchPage } from "@/features/search/search-page";
import { useTranslation } from "@/i18n/client";
import { selectLocalization } from "@/lib/localization";
import { ZoneBlockProvider } from "./components/block-renderer";
import { ZoneHeader } from "./components/zone-header";
import { parseZoneRenderProjection } from "./model/zone-render";

export function ZoneSearchPage({
	baseHref,
	zoneId,
}: {
	readonly baseHref: string;
	readonly zoneId: string;
}) {
	const { locale, t } = useTranslation(["search", "ui", "zones"]);
	const query = useGetZoneRenderProjection({
		path: { zoneId },
		query: { language: toContentLanguage(locale.target) },
	});
	const projection = useMemo(
		() => (query.data ? parseZoneRenderProjection(query.data) : null),
		[query.data],
	);
	const identity = useMemo(() => {
		if (!projection) return undefined;
		const localization = selectLocalization(
			projection.zone.localizations,
			toContentLanguage(locale.target),
			projection.zone.language,
		);
		const title = localization?.title ?? t.ui.unnamed;
		const avatar = localization?.avatar ?? projection.zone.avatar;
		return {
			title,
			avatar,
			search: {
				href: `${baseHref}/search`,
				label: t.search.withinLabel({ name: title }),
				placeholder: t.search.withinPlaceholder({ name: title }),
				avatar,
				avatarFallback: title.slice(0, 1).toUpperCase(),
			},
		};
	}, [baseHref, locale.target, projection, t.search, t.ui.unnamed]);
	useHeaderSearchOverride(identity?.search);

	if (query.isPending) return <QueryPending />;
	if (query.isError)
		return <QueryFailure error={query.error} retry={() => void query.refetch()} />;
	if (!projection || !identity) return null;
	return (
		<ZoneBlockProvider baseHref={baseHref} projection={projection}>
			<ZoneHeader avatar={identity.avatar} projection={projection} title={identity.title} />
			<ScopedSearchPage id={`zone-${zoneId}-search`} source={{ kind: "zone", zoneId }} />
		</ZoneBlockProvider>
	);
}
