"use client";

import { toContentLanguage } from "@rezics/i18n";
import { useGetApiUnitsByTypeByUnitId } from "@rezics/openapi-tanstack-query";
import { Button, PageHeading, QueryFailure, QueryPending } from "@rezics/ui";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import { UnitTagExplorer } from "@/features/tags/components/unit-tag-explorer";
import type { CatalogDetailUnitType } from "@/features/units/model/catalog-detail-section";
import { isCatalogDetailUnitFor } from "@/features/units/model/catalog-detail-unit";
import { catalogDetailHref } from "@/features/units/routing/catalog-detail-routes";
import { useTranslation } from "@/i18n/client";
import { selectLocalization } from "@/lib/localization";

export function UnitTagsPage({
	type,
	unitId,
}: {
	readonly type: CatalogDetailUnitType;
	readonly unitId: string;
}) {
	const { locale, t } = useTranslation(["tags", "ui", "units"]);
	const query = useGetApiUnitsByTypeByUnitId({ path: { type, unitId } });
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

	const localization = selectLocalization(
		query.data.localizations,
		toContentLanguage(locale.target),
		query.data.language,
	);
	return (
		<main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-6 sm:px-6 sm:py-10">
			<Button asChild className="w-fit" variant="outline">
				<Link href={catalogDetailHref(type, unitId)}>
					<ArrowLeft aria-hidden />
					{t.units.detail.backToOverview}
				</Link>
			</Button>
			<PageHeading
				description={localization?.title ?? t.ui.unnamed}
				title={t.tags.page.title}
			/>
			<p className="-mt-5 max-w-3xl text-sm leading-6 text-muted-foreground">
				{t.tags.page.description}
			</p>
			<UnitTagExplorer surface="page" type={type} unitId={unitId} />
		</main>
	);
}
