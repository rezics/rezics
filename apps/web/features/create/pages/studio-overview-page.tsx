"use client";

import { ManagementWorkspaceOverview } from "@rezics/ui";
import { AppLink as Link } from "@/features/application-shell/components/app-link";

import { useTranslation } from "@/i18n/client";
import { useStudioWorkspaceSections } from "../components/studio-workspace";

export function StudioOverviewPage() {
	const { t } = useTranslation(["create"]);
	const sections = useStudioWorkspaceSections();

	return (
		<ManagementWorkspaceOverview
			ariaLabel={t.create.workspace.overview}
			link={Link}
			sections={sections}
		/>
	);
}
