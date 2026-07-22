"use client";

import { ManagementWorkspaceSectionHeader } from "@rezics/ui";
import Link from "next/link";
import type { ReactNode } from "react";

import { useTranslation } from "@/i18n/client";
import { unitManagementHref } from "../routing/unit-management-routes";
import { useUnitManagement } from "./unit-management-workspace";

export function UnitSectionHeader({
	title,
	description,
	action,
}: {
	title: string;
	description?: string;
	action?: ReactNode;
}) {
	const { t } = useTranslation(["units"]);
	const { type, unit } = useUnitManagement();
	return (
		<ManagementWorkspaceSectionHeader
			action={action}
			backHref={unitManagementHref(type, unit.id)}
			backLabel={t.units.workspace.backToOverview}
			description={description}
			link={Link}
			title={title}
		/>
	);
}
