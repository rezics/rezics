"use client";

import { UnitDockSettings, isDockOwnerKind } from "@/features/docks";
import { useTranslation } from "@/i18n/client";
import { useUnitManagement } from "../components/unit-management-workspace";
import { UnitSectionHeader } from "../components/unit-section-header";

export function UnitDocksPage() {
	const { t } = useTranslation(["docks", "errors"]);
	const { dockKinds, type, unit } = useUnitManagement();
	if (!isDockOwnerKind(type) || dockKinds.length === 0)
		return <p className="text-destructive text-sm">{t.errors.forbidden}</p>;
	return (
		<section>
			<UnitSectionHeader description={t.docks.description} title={t.docks.title} />
			<UnitDockSettings allowedKinds={dockKinds} ownerKind={type} ownerUnitId={unit.id} />
		</section>
	);
}
