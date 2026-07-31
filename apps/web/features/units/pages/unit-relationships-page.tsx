"use client";

import { useTranslation } from "@/i18n/client";
import { useUnitManagement } from "../components/unit-management-workspace";
import { UnitRelationshipManager } from "../components/unit-relationship-manager";
import { UnitSectionHeader } from "../components/unit-section-header";
import { isWorkUnitType } from "../unit-types";

export function UnitRelationshipsPage() {
	const { t } = useTranslation(["errors", "units"]);
	const { type, unit } = useUnitManagement();
	if (!unit.capabilities.canEdit || !isWorkUnitType(type))
		return <p className="text-sm text-destructive">{t.errors.forbidden}</p>;
	return (
		<section className="grid gap-6">
			<UnitSectionHeader
				description={t.units.workspace.sections.relationships.description}
				title={t.units.workspace.sections.relationships.label}
			/>
			<UnitRelationshipManager type={type} unit={unit} />
		</section>
	);
}
