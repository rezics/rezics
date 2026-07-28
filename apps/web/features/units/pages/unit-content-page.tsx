"use client";

import { useTranslation } from "@/i18n/client";
import { useUnitManagement } from "../components/unit-management-workspace";
import { UnitSectionHeader } from "../components/unit-section-header";
import { UnitContentEditor } from "../unit-edit";

export function UnitContentPage() {
	const { t } = useTranslation(["errors", "units"]);
	const { type, unit } = useUnitManagement();
	if (!unit.capabilities.canEdit)
		return <p className="text-sm text-destructive">{t.errors.forbidden}</p>;
	return (
		<section>
			<UnitSectionHeader
				description={t.units.workspace.sections.content.description}
				title={t.units.workspace.sections.content.label}
			/>
			<UnitContentEditor type={type} unit={unit} />
		</section>
	);
}
