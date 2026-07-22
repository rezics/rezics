"use client";

import type { ManagementWorkspaceSection } from "@rezics/ui";
import {
	ManagementWorkspace,
	ManagementWorkspaceHeader,
	ManagementWorkspaceNavigation,
} from "@rezics/ui";
import { CircleUserRound, KeyRound, Settings2, ShieldCheck, UserRound } from "lucide-react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { createContext, useContext, type ReactNode } from "react";

import { RequireSession } from "@/features/auth/require-session";
import { useTranslation } from "@/i18n/client";
import type { SettingsSectionId } from "../model/settings-section";
import { parseSettingsSection, settingsSectionHref } from "../routing/settings-routes";

const SettingsSectionsContext = createContext<
	readonly ManagementWorkspaceSection<SettingsSectionId>[] | undefined
>(undefined);

export function useSettingsWorkspaceSections() {
	const sections = useContext(SettingsSectionsContext);
	if (!sections) throw new Error("Settings sections must be used inside SettingsWorkspace");
	return sections;
}

export function SettingsWorkspace({ children }: { children: ReactNode }) {
	const pathname = usePathname();
	const { t } = useTranslation(["settings"]);
	const labels = t.settings.workspace.sections;
	const sections = [
		{
			id: "profile",
			href: settingsSectionHref("profile"),
			label: labels.profile.label,
			description: labels.profile.description,
			icon: UserRound,
		},
		{
			id: "preferences",
			href: settingsSectionHref("preferences"),
			label: labels.preferences.label,
			description: labels.preferences.description,
			icon: Settings2,
		},
		{
			id: "account",
			href: settingsSectionHref("account"),
			label: labels.account.label,
			description: labels.account.description,
			icon: CircleUserRound,
		},
		{
			id: "security",
			href: settingsSectionHref("security"),
			label: labels.security.label,
			description: labels.security.description,
			icon: ShieldCheck,
		},
		{
			id: "tokens",
			href: settingsSectionHref("tokens"),
			label: labels.tokens.label,
			description: labels.tokens.description,
			icon: KeyRound,
		},
	] as const satisfies readonly ManagementWorkspaceSection<SettingsSectionId>[];

	return (
		<RequireSession>
			<SettingsSectionsContext.Provider value={sections}>
				<ManagementWorkspace
					header={
						<ManagementWorkspaceHeader
							backHref="/"
							backLabel={t.settings.workspace.backToApplication}
							description={t.settings.workspace.description}
							link={Link}
							title={t.settings.workspace.title}
						/>
					}
					navigation={
						<ManagementWorkspaceNavigation
							ariaLabel={t.settings.workspace.navigation}
							currentSectionId={parseSettingsSection(pathname)}
							link={Link}
							sections={sections}
						/>
					}
				>
					{children}
				</ManagementWorkspace>
			</SettingsSectionsContext.Provider>
		</RequireSession>
	);
}
