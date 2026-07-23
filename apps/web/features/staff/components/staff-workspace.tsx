"use client";

import { useGetApiUsersMe } from "@rezics/openapi-tanstack-query";
import type { ManagementWorkspaceSection } from "@rezics/ui";
import {
	ManagementWorkspace,
	ManagementWorkspaceHeader,
	ManagementWorkspaceNavigation,
	QueryFailure,
	QueryPending,
} from "@rezics/ui";
import { History, UsersRound } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useContext, type ReactNode } from "react";

import { RequireSession } from "@/features/auth/require-session";
import { useTranslation } from "@/i18n/client";
import type { StaffSectionId } from "../model/staff-section";
import { parseStaffSection, staffSectionHref } from "../routing/staff-routes";

const StaffSectionsContext = createContext<
	readonly ManagementWorkspaceSection<StaffSectionId>[] | undefined
>(undefined);

export function useStaffWorkspaceSections() {
	const sections = useContext(StaffSectionsContext);
	if (!sections) throw new Error("Staff sections must be used inside StaffWorkspace");
	return sections;
}

export function StaffWorkspace({ children }: { children: ReactNode }) {
	return (
		<RequireSession>
			<StaffWorkspaceContent>{children}</StaffWorkspaceContent>
		</RequireSession>
	);
}

function StaffWorkspaceContent({ children }: { children: ReactNode }) {
	const pathname = usePathname();
	const { t } = useTranslation(["errors", "staff"]);
	const me = useGetApiUsersMe();
	if (me.isPending) return <QueryPending />;
	if (me.isError || !me.data)
		return <QueryFailure error={me.error} retry={() => void me.refetch()} />;
	if (!me.data.platformCapabilities.includes("platform.grants.manage"))
		return (
			<p className="mx-auto max-w-4xl px-4 py-10 text-sm text-destructive">
				{t.errors.forbidden}
			</p>
		);

	const labels = t.staff.sections;
	const sections = [
		{
			id: "members",
			href: staffSectionHref("members"),
			label: labels.members.label,
			description: labels.members.description,
			icon: UsersRound,
		},
		{
			id: "audit",
			href: staffSectionHref("audit"),
			label: labels.audit.label,
			description: labels.audit.description,
			icon: History,
		},
	] as const satisfies readonly ManagementWorkspaceSection<StaffSectionId>[];

	return (
		<StaffSectionsContext.Provider value={sections}>
			<ManagementWorkspace
				header={
					<ManagementWorkspaceHeader
						backHref="/"
						backLabel={t.staff.backToApplication}
						description={t.staff.description}
						link={Link}
						title={t.staff.title}
					/>
				}
				navigation={
					<ManagementWorkspaceNavigation
						ariaLabel={t.staff.navigation}
						currentSectionId={parseStaffSection(pathname)}
						link={Link}
						sections={sections}
					/>
				}
			>
				{children}
			</ManagementWorkspace>
		</StaffSectionsContext.Provider>
	);
}
