"use client";

import { useGetZoneRenderProjection } from "@rezics/openapi-tanstack-query";
import { QueryFailure, QueryPending, cn } from "@rezics/ui";
import { useMemo } from "react";

import { useHeaderSearchOverride } from "@/features/application-shell/header-search";
import { useTranslation } from "@/i18n/client";
import { useLocalizationFallbackToast } from "@/i18n/use-localization-fallback-toast";
import { useLocalizationLanguages } from "@/i18n/use-localization-languages";
import { selectLocalization } from "@/lib/localization";
import { ZoneBlockProvider, ZoneDocument } from "./components/block-renderer";
import { ZoneHeader } from "./components/zone-header";
import { ZoneSurfaceContainerClassName } from "./components/zone-surface-layout";
import { parseZoneRenderProjection } from "./model/zone-render";

export type ZonePageSelection =
	| { readonly by: "home" }
	| { readonly by: "slug"; readonly slug: string }
	| { readonly by: "id"; readonly pageId: string };

export function ZonePage({
	id,
	baseHref,
	selection = { by: "home" },
}: {
	id: string;
	baseHref: string;
	selection?: ZonePageSelection;
}) {
	const { t } = useTranslation(["search", "ui", "zones"]);
	const localizationLanguages = useLocalizationLanguages();
	const query = useGetZoneRenderProjection({
		path: { zoneId: id },
		query: {
			localizationLanguages,
			...(selection.by === "slug" ? { page: selection.slug } : {}),
			...(selection.by === "id" ? { pageId: selection.pageId } : {}),
		},
	});
	useLocalizationFallbackToast({
		actualLanguage: query.data?.zone.language ?? null,
		localizationLanguages,
		unitId: id,
	});
	const projection = useMemo(
		() => (query.data ? parseZoneRenderProjection(query.data) : null),
		[query.data],
	);
	const headerSearch = useMemo(() => {
		if (!projection) return undefined;
		const localization = selectLocalization(
			projection.zone.localizations,
			projection.zone.language ?? "",
		);
		const title = localization?.title ?? t.ui.unnamed;
		return {
			href: `${baseHref}/search`,
			label: t.search.withinLabel({ name: title }),
			placeholder: t.search.withinPlaceholder({ name: title }),
			avatar: localization?.avatar ?? projection.zone.avatar,
			avatarFallback: title.slice(0, 1).toUpperCase(),
		};
	}, [baseHref, projection, t.search, t.ui.unnamed]);
	useHeaderSearchOverride(headerSearch);

	if (query.isPending) return <QueryPending />;
	if (query.isError)
		return <QueryFailure error={query.error} retry={() => void query.refetch()} />;
	if (!projection) return null;

	const localization = selectLocalization(
		projection.zone.localizations,
		projection.zone.language ?? "",
	);
	const title = localization?.title ?? t.ui.unnamed;
	const avatar = localization?.avatar ?? projection.zone.avatar;

	return (
		<ZoneBlockProvider baseHref={baseHref} projection={projection}>
			<ZoneHeader avatar={avatar} projection={projection} title={title} />
			<main className={cn(ZoneSurfaceContainerClassName, "py-8 sm:py-12")}>
				{projection.page ? (
					<ZoneDocument
						blocks={projection.page.document.blocks}
						surface={{ kind: "page", pageId: projection.page.id }}
					/>
				) : (
					<section className="mx-auto max-w-3xl py-8 text-center">
						<h1 className="font-serif font-bold text-3xl">{t.zones.emptyTitle}</h1>
						<p className="mt-3 text-muted-foreground leading-7">{t.zones.emptyBody}</p>
					</section>
				)}
			</main>
		</ZoneBlockProvider>
	);
}
