"use client";

import { useGetApiCollections } from "@rezics/openapi-tanstack-query";
import { QueryFailure, QueryPending, UnitList } from "@rezics/ui";

import { useTranslation } from "@/i18n/client";
import { useLocalizationLanguages } from "@/i18n/use-localization-languages";
import { CatalogDetailSectionFrame } from "../components/catalog-detail-section-frame";
import { useCatalogDetail } from "../components/catalog-detail-workspace";
import { catalogDetailPageCopy } from "../model/catalog-detail-copy";

export function CatalogCollectionsPage() {
	const detail = useCatalogDetail();
	const localizationLanguages = useLocalizationLanguages();
	const { t } = useTranslation(["collections", "units"]);
	const query = useGetApiCollections({
		query: {
			containsTargetId: detail.unit.id,
			limit: 50,
			localizationLanguages,
		},
	});
	const labels = catalogDetailPageCopy(t, detail.type, "collections");

	return (
		<CatalogDetailSectionFrame description={labels.description} title={labels.title}>
			{query.isPending ? <QueryPending /> : null}
			{query.isError ? (
				<QueryFailure error={query.error} retry={() => void query.refetch()} />
			) : null}
			{query.data ? (
				query.data.items.length ? (
					<UnitList
						error={false}
						href={(collection) => `/collections/${collection.id}`}
						items={query.data.items}
						pending={false}
						variant="shelf"
					/>
				) : (
					<p className="text-sm text-muted-foreground">
						{t.collections.containingUnitEmpty}
					</p>
				)
			) : null}
		</CatalogDetailSectionFrame>
	);
}
