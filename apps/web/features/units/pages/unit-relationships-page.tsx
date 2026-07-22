"use client";

import { useTranslation } from "@/i18n/client";
import { UnitAssociationProposalManager } from "@/features/governance/unit-workflows";
import { useUnitManagement } from "../components/unit-management-workspace";
import { UnitSectionHeader } from "../components/unit-section-header";
import { UnitRelationships } from "../unit-edit";

export function UnitRelationshipsPage() {
	const { t } = useTranslation(["errors", "units"]);
	const { type, unit } = useUnitManagement();
	if (!unit.capabilities.canEdit)
		return <p className="text-sm text-destructive">{t.errors.forbidden}</p>;
	return (
		<section>
			<UnitSectionHeader
				description={t.units.workspace.sections.relationships.description}
				title={t.units.workspace.sections.relationships.label}
			/>
			<UnitRelationships type={type} unit={unit} />
			<div className="mt-6 grid gap-6">
				<UnitAssociationProposalManager unitId={unit.id} />
			</div>
		</section>
	);
}
