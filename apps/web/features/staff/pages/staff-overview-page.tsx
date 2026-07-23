"use client";

import { ManagementWorkspaceOverview } from "@rezics/ui";
import Link from "next/link";

import { useTranslation } from "@/i18n/client";
import { useStaffWorkspaceSections } from "../components/staff-workspace";

export function StaffOverviewPage() {
	const { t } = useTranslation(["staff"]);
	const sections = useStaffWorkspaceSections();
	return (
		<ManagementWorkspaceOverview ariaLabel={t.staff.overview} link={Link} sections={sections} />
	);
}
