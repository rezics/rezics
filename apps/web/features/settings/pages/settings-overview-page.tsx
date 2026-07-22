"use client";

import { ManagementWorkspaceOverview } from "@rezics/ui";
import Link from "next/link";

import { useTranslation } from "@/i18n/client";
import { useSettingsWorkspaceSections } from "../components/settings-workspace";

export function SettingsOverviewPage() {
	const { t } = useTranslation(["settings"]);
	const sections = useSettingsWorkspaceSections();
	return (
		<ManagementWorkspaceOverview
			ariaLabel={t.settings.workspace.overview}
			link={Link}
			sections={sections}
		/>
	);
}
