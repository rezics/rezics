"use client";

import { toContentLanguage } from "@rezics/i18n";
import { useGetZoneRenderProjection } from "@rezics/openapi-tanstack-query";
import { QueryFailure, QueryPending } from "@rezics/ui";
import { useMemo } from "react";

import { useHeaderSearchOverride } from "@/features/application-shell/header-search";
import { useTranslation } from "@/i18n/client";
import { selectLocalization } from "@/lib/localization";
import { ZoneBlockProvider, ZoneDocument } from "./components/block-renderer";
import { ZoneHeader } from "./components/zone-header";
import { parseZoneRenderProjection } from "./model/zone-render";

export function ZonePage({ id, baseHref, page }: { id: string; baseHref: string; page?: string }) {
	const { t, locale } = useTranslation(["search", "ui", "zones"]);
	const query = useGetZoneRenderProjection({
		path: { zoneId: id },
		query: { language: toContentLanguage(locale.target), ...(page ? { page } : {}) },
	});
	const projection = useMemo(
		() => (query.data ? parseZoneRenderProjection(query.data) : null),
		[query.data],
	);
	const headerSearch = useMemo(() => {
		if (!projection) return undefined;
		const localization = selectLocalization(
			projection.zone.localizations,
			toContentLanguage(locale.target),
			projection.zone.language,
		);
		const title = localization?.title ?? t.ui.unnamed;
		return {
			href: `${baseHref}/search`,
			label: t.search.withinLabel({ name: title }),
			placeholder: t.search.withinPlaceholder({ name: title }),
			avatar: localization?.avatar ?? projection.zone.avatar,
			avatarFallback: title.slice(0, 1).toUpperCase(),
		};
	}, [baseHref, locale.target, projection, t.search, t.ui.unnamed]);
	useHeaderSearchOverride(headerSearch);

	if (query.isPending) return <QueryPending />;
	if (query.isError)
		return <QueryFailure error={query.error} retry={() => void query.refetch()} />;
	if (!projection) return null;

	const localization = selectLocalization(
		projection.zone.localizations,
		toContentLanguage(locale.target),
		projection.zone.language,
	);
	const title = localization?.title ?? t.ui.unnamed;
	const avatar = localization?.avatar ?? projection.zone.avatar;

	return (
		<ZoneBlockProvider baseHref={baseHref} projection={projection}>
			<ZoneHeader avatar={avatar} projection={projection} title={title} />
			<main>
				{projection.page ? (
					<ZoneDocument
						blocks={projection.page.document.blocks}
						surface={{ kind: "page", slug: projection.page.slug }}
					/>
				) : (
					<section className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-6">
						<h1 className="font-serif font-bold text-3xl">{t.zones.emptyTitle}</h1>
						<p className="mt-3 text-muted-foreground leading-7">{t.zones.emptyBody}</p>
					</section>
				)}
			</main>
		</ZoneBlockProvider>
	);
}
