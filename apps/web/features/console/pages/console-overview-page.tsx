"use client";

import { ManagementWorkspaceOverview } from "@rezics/ui";
import Link from "next/link";

import { useTranslation } from "@/i18n/client";
import { useConsoleWorkspace } from "../components/console-workspace";

export function ConsoleOverviewPage() {
	const { t } = useTranslation(["console"]);
	const { sections } = useConsoleWorkspace();
	return (
		<ManagementWorkspaceOverview
			ariaLabel={t.console.overview}
			link={Link}
			sections={sections}
		/>
	);
}
