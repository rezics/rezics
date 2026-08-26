"use client";

import {
	useGetZoneRenderProjection,
	usePatchApiUsersMePreferences,
} from "@rezics/openapi-tanstack-query";
import { QueryFailure, QueryPending } from "@rezics/ui";
import { useCallback, useMemo, type ReactNode } from "react";

import { useHeaderSearchOverride } from "@/features/application-shell/header-search";
import { useTranslation } from "@/i18n/client";
import { useLocalizationFallbackToast } from "@/i18n/use-localization-fallback-toast";
import { useLocalizationLanguages } from "@/i18n/use-localization-languages";
import { selectLocalization } from "@/lib/localization";
import { parseZoneRenderProjection, type ZoneRenderProjection } from "../model/zone-render";
import { ZoneBlockProvider } from "./block-renderer";
import { ZoneDockContent } from "./zone-dock-content";
import { ZoneHeader } from "./zone-header";
import { ZonePageAggregateProvider } from "./zone-page-aggregate-provider";
import { ZoneThemeContent } from "./zone-theme-content";

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
	const { t } = useTranslation(["search", "ui"]);
	const localizationLanguages = useLocalizationLanguages();
	const query = useGetZoneRenderProjection({
		path: { zoneId: id },
		query: {
			localizationLanguages,
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
		mutation: { onSuccess: () => void query.refetch() },
	});
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
	if (query.isError) return <QueryFailure error={query.error} retry={() => void query.refetch()} />;
	if (!projection) return null;

	const localization = selectLocalization(
		projection.zone.localizations,
		projection.zone.language ?? "",
	);
	const title = localization?.title ?? t.ui.unnamed;
	const avatar = localization?.avatar ?? projection.zone.avatar;

	const surface = (
		<ZoneBlockProvider baseHref={baseHref} projection={projection}>
			<ZoneThemeContent
				hero={projection.zone.themeHero}
				theme={projection.zone.themeDocument}
				stylesheet={projection.customThemeStylesheet}
				onUseDefaultTheme={() =>
					useDefaultTheme.mutate({ body: { customZoneThemesEnabled: false } })
				}
				useDefaultThemeFailed={useDefaultTheme.isError}
				useDefaultThemePending={useDefaultTheme.isPending}
			>
				<ZoneHeader avatar={avatar} projection={projection} title={title} />
				<ZoneDockContent projection={projection} />
				{children(projection)}
			</ZoneThemeContent>
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
