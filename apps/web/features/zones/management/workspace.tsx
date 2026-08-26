"use client";

import {
	type GetApiZonesByZoneIdStatus200,
	useGetApiZonesByZoneId,
} from "@rezics/openapi-tanstack-query";
import type { ManagementWorkspaceSection } from "@rezics/ui";
import {
	ManagementWorkspace,
	ManagementWorkspaceHeader,
	ManagementWorkspaceNavigation,
	QueryFailure,
	QueryPending,
} from "@rezics/ui";
import { Blocks, Files, LayoutDashboard, ListTree, Palette, Search } from "lucide-react";
import { AppLink as Link } from "@/features/application-shell/components/app-link";
import { usePathname } from "next/navigation";
import { createContext, useContext, type ReactNode } from "react";

import { RequireSession } from "@/features/auth/require-session";
import { ContentLanguageEditorProvider } from "@/features/content-languages/hooks/use-content-language-editor";
import { useTranslation } from "@/i18n/client";
import { useLocalizationLanguages } from "@/i18n/use-localization-languages";
import { selectLocalization } from "@/lib/localization";
import {
	parseZoneManagementSection,
	type ZoneManagementSectionId,
	zoneManagementSectionHref,
} from "./model";

interface ZoneManagementContextValue {
	readonly zoneId: string;
	readonly zone: GetApiZonesByZoneIdStatus200;
	readonly sections: readonly ManagementWorkspaceSection<ZoneManagementSectionId>[];
}

const ZoneManagementContext = createContext<ZoneManagementContextValue | null>(null);

export function useZoneManagement() {
	const value = useContext(ZoneManagementContext);
	if (!value) throw new Error("Zone management context is unavailable outside its workspace");
	return value;
}

export function ZoneManagementWorkspace({
	zoneId,
	children,
}: {
	zoneId: string;
	children: ReactNode;
}) {
	return (
		<RequireSession>
			<ZoneManagementWorkspaceContent zoneId={zoneId}>{children}</ZoneManagementWorkspaceContent>
		</RequireSession>
	);
}

function ZoneManagementWorkspaceContent({
	zoneId,
	children,
}: {
	zoneId: string;
	children: ReactNode;
}) {
	const pathname = usePathname();
	const { t } = useTranslation(["ui", "zones"]);
	const localizationLanguages = useLocalizationLanguages();
	const query = useGetApiZonesByZoneId({
		path: { zoneId },
		query: { localizationLanguages },
	});
	if (query.isPending) return <QueryPending />;
	if (query.isError) return <QueryFailure error={query.error} retry={() => void query.refetch()} />;
	const labels = t.zones.management.sections;
	const sections: ManagementWorkspaceSection<ZoneManagementSectionId>[] = [
		{
			id: "overview",
			href: zoneManagementSectionHref(zoneId, "overview"),
			label: labels.overview.label,
			description: labels.overview.description,
			icon: LayoutDashboard,
		},
		{
			id: "pages",
			href: zoneManagementSectionHref(zoneId, "pages"),
			label: labels.pages.label,
			description: labels.pages.description,
			icon: Files,
		},
		{
			id: "search",
			href: zoneManagementSectionHref(zoneId, "search"),
			label: labels.search.label,
			description: labels.search.description,
			icon: Search,
		},
		{
			id: "navigation",
			href: zoneManagementSectionHref(zoneId, "navigation"),
			label: labels.navigation.label,
			description: labels.navigation.description,
			icon: ListTree,
		},
		{
			id: "layout",
			href: zoneManagementSectionHref(zoneId, "layout"),
			label: labels.layout.label,
			description: labels.layout.description,
			icon: Blocks,
		},
		{
			id: "theme",
			href: zoneManagementSectionHref(zoneId, "theme"),
			label: labels.theme.label,
			description: labels.theme.description,
			icon: Palette,
		},
	];
	const localization = selectLocalization(
		query.data.localizations,
		query.data.language,
		query.data.language,
	);
	const currentSectionId = parseZoneManagementSection(pathname, zoneId);
	return (
		<ZoneManagementContext.Provider value={{ zoneId, zone: query.data, sections }}>
			<ContentLanguageEditorProvider
				localizations={query.data.localizations}
				onLanguagesChanged={async () => {
					await query.refetch();
				}}
				unitId={zoneId}
			>
				<ManagementWorkspace
					header={
						<ManagementWorkspaceHeader
							backHref={`/zone/${zoneId}`}
							backLabel={t.zones.management.backToZone}
							description={t.zones.management.description}
							link={Link}
							title={localization?.title ?? t.zones.management.title}
						/>
					}
					navigation={
						<ManagementWorkspaceNavigation
							ariaLabel={t.zones.management.navigation}
							currentSectionId={currentSectionId}
							link={Link}
							sections={sections}
						/>
					}
				>
					{children}
				</ManagementWorkspace>
			</ContentLanguageEditorProvider>
		</ZoneManagementContext.Provider>
	);
}
