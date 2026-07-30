"use client";

import { ManagementWorkspaceOverview } from "@rezics/ui";
import { AppLink as Link } from "@/features/application-shell/components/app-link";

import { useTranslation } from "@/i18n/client";
import { useCollectionManagement } from "../components/collection-management-workspace";

export function CollectionManagementOverviewPage() {
	const { t } = useTranslation(["collections"]);
	const { sections } = useCollectionManagement();
	return (
		<ManagementWorkspaceOverview
			ariaLabel={t.collections.workspace.overview}
			link={Link}
			sections={sections}
		/>
	);
}
