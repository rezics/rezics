"use client";

import { useQueryClient } from "@tanstack/react-query";

import { UnitRevisionHistory } from "@/features/history/components/unit-revision-history";
import { useTranslation } from "@/i18n/client";
import { useUnitManagement } from "../components/unit-management-workspace";
import { UnitSectionHeader } from "../components/unit-section-header";
import { invalidateUnitDetail } from "../unit-cache";
import { unitManagementSectionHref } from "../routing/unit-management-routes";

export function UnitHistoryPage() {
	const { t } = useTranslation(["history"]);
	const queryClient = useQueryClient();
	const { type, unit } = useUnitManagement();
	const historyHref = unitManagementSectionHref(type, unit.id, "history");
	return (
		<section>
			<UnitSectionHeader description={t.history.description} title={t.history.title} />
			<UnitRevisionHistory
				compareHref={(from, to) =>
					`${historyHref}/compare?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
				}
				onChanged={() => invalidateUnitDetail(queryClient, type, unit.id, true)}
				unitId={unit.id}
			/>
		</section>
	);
}
