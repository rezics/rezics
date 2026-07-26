"use client";

import { UnitAccessManager } from "@/features/governance/components/unit-access-manager";
import { useTranslation } from "@/i18n/client";
import { PostManagementSectionHeader } from "../components/post-management-section-header";
import { usePostManagement } from "../components/post-management-workspace";

export function PostAccessPage() {
	const { t } = useTranslation(["errors", "units"]);
	const { resource } = usePostManagement();
	if (!resource.item.capabilities.canManageAccess)
		return <p className="text-sm text-destructive">{t.errors.forbidden}</p>;
	return (
		<section>
			<PostManagementSectionHeader
				description={t.units.workspace.sections.access.description}
				title={t.units.workspace.sections.access.label}
			/>
			<UnitAccessManager unitId={resource.item.id} />
		</section>
	);
}
