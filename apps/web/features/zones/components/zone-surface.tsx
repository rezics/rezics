"use client";

import {
	useGetZoneRenderProjection,
	usePatchApiUsersMePreferences,
} from "@rezics/openapi-tanstack-query";
import { QueryFailure, QueryPending } from "@rezics/ui";
import { useCallback, useMemo, type ReactNode } from "react";

import { useHeaderSearchOverride } from "@/features/application-shell/header-search";
import { UnitPresentationHost } from "@/features/presentation/components/unit-presentation-host";
import { hasSafeThemeQuery } from "@/features/presentation/model/safe-mode";
import { useTranslation } from "@/i18n/client";
import { useLocalizationFallbackToast } from "@/i18n/use-localization-fallback-toast";
import { useLocalizationLanguages } from "@/i18n/use-localization-languages";
import { selectLocalization } from "@/lib/localization";
import { zoneDockPresentation } from "../model/zone-dock-presentation";
import { parseZoneRenderProjection, type ZoneRenderProjection } from "../model/zone-render";
import { zoneHomeSearchHref } from "../model/zone-search-entry";
import { ZoneBlockProvider, ZoneDocument } from "./block-renderer";
import { ZoneDockContent } from "./zone-dock-content";
import { ZoneHeader } from "./zone-header";
import { ZonePageAggregateProvider } from "./zone-page-aggregate-provider";
import { ZoneAppearanceContent } from "./zone-appearance-content";
import { ZoneSurfaceContainerClassName } from "./zone-surface-layout";

export type ZonePageSelection =
	| { readonly by: "home" }
	| { readonly by: "slug"; readonly slug: string }
	| { readonly by: "id"; readonly pageId: string };

export function ZoneSurface({
	aggregatePage = false,
	baseHref,
	children,
	id,
	postId,
	selection = { by: "home" },
}: {
	readonly aggregatePage?: boolean;
	readonly baseHref: string;
	readonly children: (projection: ZoneRenderProjection) => ReactNode;
	readonly id: string;
	readonly postId?: string;
	readonly selection?: ZonePageSelection;
}) {
	const { t } = useTranslation(["search", "ui", "zones"]);
	const localizationLanguages = useLocalizationLanguages();
	const safeMode = typeof window === "undefined" || hasSafeThemeQuery(window.location.search);
	const query = useGetZoneRenderProjection({
		path: { zoneId: id },
		query: {
			localizationLanguages,
			safeMode,
			...(selection.by === "slug" ? { page: selection.slug } : {}),
			...(selection.by === "id" ? { pageId: selection.pageId } : {}),
			...(postId ? { postId } : {}),
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
	const refetchProjection = useCallback(() => void query.refetch(), [query.refetch]);
	const useDefaultTheme = usePatchApiUsersMePreferences({
		mutation: { onSuccess: () => window.location.reload() },
	});
	const headerSearch = useMemo(() => {
		if (!projection) return undefined;
		const localization = selectLocalization(
			projection.zone.localizations,
			projection.zone.language ?? "",
		);
		const title = localization?.title ?? t.ui.unnamed;
		return {
			href: zoneHomeSearchHref(baseHref),
			label: t.search.withinLabel({ name: title }),
			placeholder: t.search.withinPlaceholder({ name: title }),
			avatar: localization?.avatar ?? projection.zone.avatar,
			avatarFallback: title.slice(0, 1).toUpperCase(),
		};
	}, [baseHref, projection, t.search, t.ui.unnamed]);
	useHeaderSearchOverride(headerSearch);

	if (query.isPending) return <QueryPending />;
	if (query.isError) return <QueryFailure error={query.error} retry={() => void query.refetch()} />;
	if (!projection) return null;

	const localization = selectLocalization(
		projection.zone.localizations,
		projection.zone.language ?? "",
	);
	const title = localization?.title ?? t.ui.unnamed;
	const avatar = localization?.avatar ?? projection.zone.avatar;
	const hostUnit = { id: projection.zone.id, kind: "zone" } as const;
	const dockPresentation = zoneDockPresentation(
		projection.dock?.document.blocks ?? [],
		projection.navigations,
	);

	const surface = (
		<ZoneBlockProvider baseHref={baseHref} projection={projection}>
			<ZoneAppearanceContent appearance={projection.zone.appearanceDocument}>
				<UnitPresentationHost
					copy={{
						defaultThemeAction: t.zones.theme.viewerDefault,
						defaultThemeFailed: t.zones.theme.viewerDefaultFailed,
						defaultThemeScope: t.zones.theme.viewerDefaultScope,
						runtimeFailed: t.zones.theme.runtimeFailed,
					}}
					headerLabel={t.zones.navigation}
					hostUnit={hostUnit}
					onUseDefaultTheme={() => useDefaultTheme.mutate({ body: { customThemesEnabled: false } })}
					platformHeader={
						<ZoneHeader
							avatar={avatar}
							canManage={projection.zone.capabilities.canManage}
							menuBlocks={dockPresentation.menuBlocks}
							title={title}
							zoneId={projection.zone.id}
						/>
					}
					presentation={projection.resolvedPresentation}
					renderRegion={(document, region) => (
						<div className={ZoneSurfaceContainerClassName}>
							<ZoneDocument
								blocks={document.blocks}
								navigationLayout={region === "header" ? "horizontal" : "vertical"}
								surface={{
									kind: region === "header" ? "presentation-header" : "presentation-footer",
								}}
							/>
						</div>
					)}
					useDefaultThemeFailed={useDefaultTheme.isError}
					useDefaultThemePending={useDefaultTheme.isPending}
				>
					{projection.zone.themeHero ? (
						<div aria-hidden className="max-h-80 min-h-32 overflow-hidden" data-zone-part="hero">
							<img
								alt=""
								className="h-full max-h-80 min-h-32 w-full object-cover"
								src={projection.zone.themeHero.url}
							/>
						</div>
					) : null}
					<ZoneDockContent blocks={dockPresentation.contentBlocks} />
					{children(projection)}
				</UnitPresentationHost>
			</ZoneAppearanceContent>
		</ZoneBlockProvider>
	);
	return aggregatePage && projection.page ? (
		<ZonePageAggregateProvider
			localizationLanguages={localizationLanguages}
			onRevisionConflict={refetchProjection}
			page={projection.page}
			zoneId={projection.zone.id}
		>
			{surface}
		</ZonePageAggregateProvider>
	) : (
		surface
	);
}
