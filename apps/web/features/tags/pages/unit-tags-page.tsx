"use client";

import { useGetApiUnitsByTypeByUnitId } from "@rezics/openapi-tanstack-query";
import { Button, PageHeading, QueryFailure, QueryPending } from "@rezics/ui";
import { ArrowLeft } from "lucide-react";
import { AppLink as Link } from "@/features/application-shell/components/app-link";

import { UnitTagExplorer } from "@/features/tags/components/unit-tag-explorer";
import { useChineseContentText } from "@/features/content-language-display/chinese-content-display-context";
import type { CatalogDetailUnitType } from "@/features/units/model/catalog-detail-section";
import { isCatalogDetailUnitFor } from "@/features/units/model/catalog-detail-unit";
import { catalogDetailHref } from "@/features/units/routing/catalog-detail-routes";
import { useTranslation } from "@/i18n/client";
import { useLocalizationFallbackToast } from "@/i18n/use-localization-fallback-toast";
import { useLocalizationLanguages } from "@/i18n/use-localization-languages";
import { selectLocalization } from "@/lib/localization";

export function UnitTagsPage({
	type,
	unitId,
}: {
	readonly type: CatalogDetailUnitType;
	readonly unitId: string;
}) {
	const { t } = useTranslation(["tags", "ui", "units"]);
	const localizationLanguages = useLocalizationLanguages();
	const query = useGetApiUnitsByTypeByUnitId({
		path: { type, unitId },
		query: { localizationLanguages },
	});
	useLocalizationFallbackToast({
		actualLanguage: query.data?.language ?? null,
		localizationLanguages,
		unitId,
	});
	const localization =
		query.data && isCatalogDetailUnitFor(query.data, type)
			? selectLocalization(query.data.localizations, query.data.language, query.data.language)
			: null;
	const displayedTitle = useChineseContentText(
		localization?.title ?? t.ui.unnamed,
		localization?.language,
	);
	if (query.isPending) return <QueryPending />;
	if (query.isError || !query.data)
		return <QueryFailure error={query.error} retry={() => void query.refetch()} />;
	if (!isCatalogDetailUnitFor(query.data, type))
		return (
			<QueryFailure
				error={new Error("Catalog Unit type mismatch")}
				retry={() => void query.refetch()}
			/>
		);

	return (
		<main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-6 sm:px-6 sm:py-10">
			<Button asChild className="w-fit" variant="outline">
				<Link href={catalogDetailHref(type, unitId)}>
					<ArrowLeft aria-hidden />
					{t.units.detail.backToOverview}
				</Link>
			</Button>
			<PageHeading description={displayedTitle} title={t.tags.page.title} />
			<p className="-mt-5 max-w-3xl text-sm leading-6 text-muted-foreground">
				{t.tags.page.description}
			</p>
			<UnitTagExplorer surface="page" type={type} unitId={unitId} />
		</main>
	);
}
