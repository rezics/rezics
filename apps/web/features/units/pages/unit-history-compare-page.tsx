"use client";

import { UnitRevisionCompare } from "@/features/history/components/unit-revision-compare";
import { useTranslation } from "@/i18n/client";
import { useUnitManagement } from "../components/unit-management-workspace";
import { UnitSectionHeader } from "../components/unit-section-header";

export function UnitHistoryComparePage({ from, to }: { from: string | null; to: string | null }) {
	const { t } = useTranslation(["errors", "history"]);
	const { unit } = useUnitManagement();
	return (
		<section>
			<UnitSectionHeader title={t.history.compareTitle} />
			{from && to ? (
				<UnitRevisionCompare from={from} to={to} unitId={unit.id} />
			) : (
				<p className="text-sm text-destructive">{t.errors.invalid}</p>
			)}
		</section>
	);
}
