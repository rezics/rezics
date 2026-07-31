"use client";

import { ManagementWorkspaceOverview } from "@rezics/ui";

import { AppLink as Link } from "@/features/application-shell/components/app-link";
import { useTranslation } from "@/i18n/client";
import { useTagManagement } from "../components/tag-management-workspace";

export function TagManagementOverviewPage() {
	const { t } = useTranslation(["tags"]);
	const { sections } = useTagManagement();
	return (
		<ManagementWorkspaceOverview
			ariaLabel={t.tags.detail.editNavigation}
			link={Link}
			sections={sections}
		/>
	);
}
