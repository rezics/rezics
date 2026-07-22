"use client";

import { UnitAccessManager } from "@/features/governance/components/unit-access-manager";
import { useTranslation } from "@/i18n/client";
import { UnitSectionHeader } from "../components/unit-section-header";
import { useUnitManagement } from "../components/unit-management-workspace";

export function UnitAccessPage() {
	const { t } = useTranslation(["errors", "units"]);
	const { unit } = useUnitManagement();
	if (!unit.capabilities.canManageAccess)
		return <p className="text-sm text-destructive">{t.errors.forbidden}</p>;
	return (
		<section>
			<UnitSectionHeader
				description={t.units.workspace.sections.access.description}
				title={t.units.workspace.sections.access.label}
			/>
			<UnitAccessManager unitId={unit.id} />
		</section>
	);
}
