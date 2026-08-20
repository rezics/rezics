"use client";

import { useTranslation } from "@/i18n/client";
import { UnitDetailSectionFrame } from "../components/unit-detail-section-frame";
import { UnitSeriesMemberships } from "../components/unit-series-memberships";
import { UnitSubjectGroups } from "../components/unit-subject-groups";
import { UnitVariantList } from "../components/unit-variant-list";
import { useUnitDetail } from "../components/unit-detail-workspace";
import { unitDetailPageCopy } from "../model/unit-detail-copy";

export function UnitAssociationsPage() {
	const detail = useUnitDetail();
	const { t } = useTranslation(["actions", "engagement", "feed", "state", "ui", "units"]);
	const labels = unitDetailPageCopy(t, detail.type, "associations");
	return (
		<UnitDetailSectionFrame description={labels.description} title={labels.title}>
			<section className="grid gap-3">
				<div className="grid gap-1">
					<h2 className="font-heading text-xl font-bold">{t.units.detail.subjectAssociations}</h2>
				</div>
				{detail.unit.subjectAssociations.length ? (
					<UnitSubjectGroups associations={detail.unit.subjectAssociations} />
				) : (
					<p className="text-sm text-muted-foreground">{t.state.empty}</p>
				)}
			</section>

			{detail.type === "series" ? null : (
				<>
					<UnitSeriesMemberships unitId={detail.unit.id} />
					<UnitVariantList context={detail.unit.variantContext} />
				</>
			)}
		</UnitDetailSectionFrame>
	);
}
