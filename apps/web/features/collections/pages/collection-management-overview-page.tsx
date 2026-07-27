"use client";

import { ManagementWorkspaceOverview } from "@rezics/ui";
import Link from "next/link";

import { useTranslation } from "@/i18n/client";
import { useCollectionManagement } from "../components/collection-management-workspace";

export function CollectionManagementOverviewPage() {
	const { sections } = useCollectionManagement();
	const { t } = useTranslation(["collections"]);
	return (
		<ManagementWorkspaceOverview
			ariaLabel={t.collections.workspace.overview}
			link={Link}
			sections={sections}
		/>
	);
}
