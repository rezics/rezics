"use client";

import { UnitSectionHeader } from "@/features/units/components/unit-section-header";
import { useUnitManagement } from "@/features/units/components/unit-management-workspace";
import { useTranslation } from "@/i18n/client";
import { RealmPublicationManager } from "../components/realm-publication-manager";

export function UnitRealmPublicationsPage() {
	const { t } = useTranslation(["units"]);
	const { unit } = useUnitManagement();
	return (
		<section className="grid gap-8">
			<UnitSectionHeader
				description={t.units.realmPublications.description}
				title={t.units.realmPublications.title}
			/>
			<RealmPublicationManager unitId={unit.id} />
		</section>
	);
}
