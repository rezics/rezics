"use client";

import { UnitBasicEditor } from "../unit-edit";
import { useUnitManagement } from "../components/unit-management-workspace";
import { UnitSectionHeader } from "../components/unit-section-header";
import { useTranslation } from "@/i18n/client";

export function UnitBasicPage() {
	const { t } = useTranslation(["errors", "units"]);
	const { type, unit } = useUnitManagement();
	if (!unit.capabilities.canEdit)
		return <p className="text-sm text-destructive">{t.errors.forbidden}</p>;
	return (
		<section>
			<UnitSectionHeader
				description={t.units.workspace.sections.basic.description}
				title={t.units.workspace.sections.basic.label}
			/>
			<UnitBasicEditor type={type} unit={unit} />
		</section>
	);
}
