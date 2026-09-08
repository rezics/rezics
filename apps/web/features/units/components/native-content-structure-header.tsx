"use client";

import type { ReactNode } from "react";
import { ManagementWorkspaceSectionHeader } from "@rezics/ui";
import { AppLink } from "@/features/application-shell/components/app-link";
import { useTranslation } from "@/i18n/client";

export function NativeContentStructureHeader({
	owner,
	unitId,
	action,
}: {
	readonly owner: "publishing" | "program";
	readonly unitId: string;
	readonly action?: ReactNode;
}) {
	const { t } = useTranslation(["units"]);
	return (
		<ManagementWorkspaceSectionHeader
			action={action}
			backHref={`/catalog/${owner}/${unitId}`}
			backLabel={t.units.workspace.backToOverview}
			link={AppLink}
			title={t.units.workspace.sections.contentStructure.label}
		/>
	);
}
