"use client";

import { ManagementWorkspaceOverview } from "@rezics/ui";
import Link from "next/link";

import { useTranslation } from "@/i18n/client";
import { useUnitManagement } from "../components/unit-management-workspace";

export function UnitManagementOverviewPage() {
	const { t } = useTranslation(["units"]);
	const { sections } = useUnitManagement();
	return (
		<ManagementWorkspaceOverview
			ariaLabel={t.units.workspace.overview}
			link={Link}
			sections={sections}
		/>
	);
}
