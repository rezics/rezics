"use client";

import { CatalogDetailSectionFrame } from "../components/catalog-detail-section-frame";
import { useCatalogDetail } from "../components/catalog-detail-workspace";
import { SeriesReleaseFeed } from "../components/series-release-feed";
import { useTranslation } from "@/i18n/client";

export function CatalogSeriesReleasesPage() {
	const detail = useCatalogDetail();
	const { t } = useTranslation(["units"]);
	if (detail.type !== "series")
		throw new Error("Series releases must be rendered for a Series Unit");

	return (
		<CatalogDetailSectionFrame
			description={t.units.detail.sectionDescriptions.series.releases}
			title={t.units.detail.tabs.series.releases}
		>
			<SeriesReleaseFeed seriesId={detail.unit.id} />
		</CatalogDetailSectionFrame>
	);
}
