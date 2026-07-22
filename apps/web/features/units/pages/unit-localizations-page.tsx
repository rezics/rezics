"use client";

import { useTranslation } from "@/i18n/client";
import { useUnitManagement } from "../components/unit-management-workspace";
import { UnitSectionHeader } from "../components/unit-section-header";
import { UnitLocalizationEditor } from "../unit-edit";

export function UnitLocalizationsPage() {
	const { t } = useTranslation(["errors", "units"]);
	const { type, unit } = useUnitManagement();
	if (!unit.capabilities.canEdit)
		return <p className="text-sm text-destructive">{t.errors.forbidden}</p>;
	return (
		<section>
			<UnitSectionHeader
				description={t.units.workspace.sections.localizations.description}
				title={t.units.workspace.sections.localizations.label}
			/>
			<UnitLocalizationEditor type={type} unit={unit} />
		</section>
	);
}
