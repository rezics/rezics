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
import { History, KeyRound, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useContext, type ReactNode } from "react";

import { RequireSession } from "@/features/auth/require-session";
import { useTranslation } from "@/i18n/client";
import type { ConsoleSectionId } from "../model/console-section";
import { consoleSectionHref, parseConsoleSection } from "../routing/console-routes";

interface ConsoleWorkspaceModel {
	readonly sections: readonly ManagementWorkspaceSection<ConsoleSectionId>[];
	readonly canReadAccess: boolean;
	readonly canManageAccess: boolean;
	readonly canModerate: boolean;
	readonly canReadAudit: boolean;
}

const ConsoleWorkspaceContext = createContext<ConsoleWorkspaceModel | undefined>(undefined);

export function useConsoleWorkspace() {
	const model = useContext(ConsoleWorkspaceContext);
	if (!model) throw new Error("Console workspace must be used inside ConsoleWorkspace");
	return model;
}

export function ConsoleWorkspace({ children }: { children: ReactNode }) {
	return (
		<RequireSession>
			<ConsoleWorkspaceContent>{children}</ConsoleWorkspaceContent>
		</RequireSession>
	);
}

function ConsoleWorkspaceContent({ children }: { children: ReactNode }) {
	const pathname = usePathname();
	const { t } = useTranslation(["console", "errors"]);
	const me = useGetApiUsersMe();
	if (me.isPending) return <QueryPending />;
	if (me.isError || !me.data)
		return <QueryFailure error={me.error} retry={() => void me.refetch()} />;

	const capabilities = new Set(me.data.platformCapabilities);
	const canReadAccess = capabilities.has("platform.access.read");
	const canManageAccess = capabilities.has("platform.access.manage");
	const canModerate = capabilities.has("platform.moderate");
	const canReadAudit = capabilities.has("platform.audit.read");
	const labels = t.console.sections;
	const sections = [
		...(canReadAccess
			? [
					{
						id: "access" as const,
						href: consoleSectionHref("access"),
						label: labels.access.label,
						description: labels.access.description,
						icon: KeyRound,
					},
				]
			: []),
		...(canModerate
			? [
					{
						id: "moderation" as const,
						href: consoleSectionHref("moderation"),
						label: labels.moderation.label,
						description: labels.moderation.description,
						icon: ShieldCheck,
					},
				]
			: []),
		...(canReadAudit
			? [
					{
						id: "audit" as const,
						href: consoleSectionHref("audit"),
						label: labels.audit.label,
						description: labels.audit.description,
						icon: History,
					},
				]
			: []),
	] satisfies readonly ManagementWorkspaceSection<ConsoleSectionId>[];

	if (sections.length === 0)
		return (
			<p className="mx-auto max-w-4xl px-4 py-10 text-destructive text-sm">
				{t.errors.forbidden}
			</p>
		);

	return (
		<ConsoleWorkspaceContext.Provider
			value={{
				sections,
				canReadAccess,
				canManageAccess,
				canModerate,
				canReadAudit,
			}}
		>
			<ManagementWorkspace
				header={
					<ManagementWorkspaceHeader
						backHref="/"
						backLabel={t.console.backToApplication}
						description={t.console.description}
						link={Link}
						title={t.console.title}
					/>
				}
				navigation={
					<ManagementWorkspaceNavigation
						ariaLabel={t.console.navigation}
						currentSectionId={parseConsoleSection(pathname)}
						link={Link}
						sections={sections}
					/>
				}
			>
				{children}
			</ManagementWorkspace>
		</ConsoleWorkspaceContext.Provider>
	);
}
