"use client";

import { UnitDetailSectionFrame } from "../components/unit-detail-section-frame";
import { useUnitDetail } from "../components/unit-detail-workspace";
import { SeriesReleaseFeed } from "../components/series-release-feed";
import { useTranslation } from "@/i18n/client";

export function UnitSeriesReleasesPage() {
	const detail = useUnitDetail();
	const { t } = useTranslation(["units"]);
	if (detail.type !== "series")
		throw new Error("Series releases must be rendered for a Series Unit");

	return (
		<UnitDetailSectionFrame
			description={t.units.detail.sectionDescriptions.series.releases}
			title={t.units.detail.tabs.series.releases}
		>
			<SeriesReleaseFeed seriesId={detail.unit.id} />
		</UnitDetailSectionFrame>
	);
}
