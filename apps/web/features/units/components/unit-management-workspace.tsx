"use client";

import { toContentLanguage } from "@rezics/i18n";
import {
	type GetApiUnitsByTypeByUnitIdStatus200,
	useGetApiUnitsByTypeByUnitId,
} from "@rezics/openapi-tanstack-query";
import type { ManagementWorkspaceSection } from "@rezics/ui";
import {
	ManagementWorkspace,
	ManagementWorkspaceHeader,
	ManagementWorkspaceNavigation,
	ManagementWorkspaceSectionHeader,
	QueryFailure,
	QueryPending,
} from "@rezics/ui";
import {
	BookOpenText,
	History,
	Languages,
	LibraryBig,
	Link2,
	ListTree,
	ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useContext, type ReactNode } from "react";

import { RequireSession } from "@/features/auth/require-session";
import { useTranslation } from "@/i18n/client";
import { selectLocalization } from "@/lib/localization";
import {
	canOpenUnitManagement,
	getUnitManagementSectionIds,
	type UnitManagementSectionId,
} from "../model/unit-management-section";
import {
	parseUnitManagementSection,
	unitHref,
	unitManagementHref,
	unitManagementSectionHref,
} from "../routing/unit-management-routes";
import type { UnitType } from "../unit-types";

interface UnitManagementContextValue {
	type: UnitType;
	unit: GetApiUnitsByTypeByUnitIdStatus200;
	sections: readonly ManagementWorkspaceSection<UnitManagementSectionId>[];
}

const UnitManagementContext = createContext<UnitManagementContextValue | undefined>(undefined);

export function useUnitManagement() {
	const value = useContext(UnitManagementContext);
	if (!value) throw new Error("Unit management context is unavailable outside its workspace");
	return value;
}

export function UnitManagementWorkspace({
	type,
	unitId,
	children,
}: {
	type: UnitType;
	unitId: string;
	children: ReactNode;
}) {
	return (
		<RequireSession>
			<UnitManagementWorkspaceContent type={type} unitId={unitId}>
				{children}
			</UnitManagementWorkspaceContent>
		</RequireSession>
	);
}

function UnitManagementWorkspaceContent({
	type,
	unitId,
	children,
}: {
	type: UnitType;
	unitId: string;
	children: ReactNode;
}) {
	const pathname = usePathname();
	const { t, locale } = useTranslation(["errors", "units"]);
	const query = useGetApiUnitsByTypeByUnitId({ path: { type, unitId } });
	if (query.isPending) return <QueryPending />;
	if (query.isError || !query.data)
		return <QueryFailure error={query.error} retry={() => void query.refetch()} />;
	const { capabilities } = query.data;
	if (!canOpenUnitManagement(capabilities))
		return (
			<main className="mx-auto grid min-h-64 w-full max-w-4xl place-items-center px-4 py-10">
				<p className="text-sm text-destructive">{t.errors.forbidden}</p>
			</main>
		);
	const labels = t.units.workspace.sections;
	const allSections: ManagementWorkspaceSection<UnitManagementSectionId>[] = [
		{
			id: "basic",
			href: unitManagementSectionHref(type, unitId, "basic"),
			label: labels.basic.label,
			description: labels.basic.description,
			icon: BookOpenText,
		},
		{
			id: "localizations",
			href: unitManagementSectionHref(type, unitId, "localizations"),
			label: labels.localizations.label,
			description: labels.localizations.description,
			icon: Languages,
		},
		{
			id: "relationships",
			href: unitManagementSectionHref(type, unitId, "relationships"),
			label: labels.relationships.label,
			description: labels.relationships.description,
			icon: Link2,
		},
		{
			id: "content-structure",
			href: unitManagementSectionHref(type, unitId, "content-structure"),
			label: labels.contentStructure.label,
			description:
				type === "book"
					? labels.contentStructure.description
					: t.units.content.developmentDescription,
			icon: ListTree,
			...(type === "media" || type === "software"
				? { badge: labels.contentStructure.developmentBadge }
				: {}),
		},
		{
			id: "releases",
			href: unitManagementSectionHref(type, unitId, "releases"),
			label: labels.releases.label,
			description: labels.releases.description,
			icon: LibraryBig,
		},
		{
			id: "access",
			href: unitManagementSectionHref(type, unitId, "access"),
			label: labels.access.label,
			description: labels.access.description,
			icon: ShieldCheck,
		},
		{
			id: "history",
			href: unitManagementSectionHref(type, unitId, "history"),
			label: labels.history.label,
			description: labels.history.description,
			icon: History,
		},
	];
	const visibleSectionIds = new Set(getUnitManagementSectionIds(type, capabilities));
	const candidates = allSections.filter((section) => visibleSectionIds.has(section.id));
	const localization = selectLocalization(
		query.data.localizations,
		toContentLanguage(locale.target),
		query.data.language,
	);
	const currentSectionId = parseUnitManagementSection(pathname, type, unitId);
	const requestedSection = allSections.find((section) => section.id === currentSectionId);
	const sectionAllowed = !currentSectionId || visibleSectionIds.has(currentSectionId);
	return (
		<UnitManagementContext.Provider value={{ type, unit: query.data, sections: candidates }}>
			<ManagementWorkspace
				header={
					<ManagementWorkspaceHeader
						backHref={unitHref(type, unitId)}
						backLabel={t.units.workspace.backToUnit}
						description={t.units.workspace.description}
						link={Link}
						title={localization?.title ?? t.units.workspace.title}
					/>
				}
				navigation={
					<ManagementWorkspaceNavigation
						ariaLabel={t.units.workspace.navigation}
						currentSectionId={sectionAllowed ? currentSectionId : undefined}
						link={Link}
						sections={candidates}
					/>
				}
			>
				{sectionAllowed ? (
					children
				) : requestedSection ? (
					<section>
						<ManagementWorkspaceSectionHeader
							backHref={unitManagementHref(type, unitId)}
							backLabel={t.units.workspace.backToOverview}
							description={requestedSection.description}
							link={Link}
							title={requestedSection.label}
						/>
						<p className="text-sm text-destructive">{t.errors.forbidden}</p>
					</section>
				) : null}
			</ManagementWorkspace>
		</UnitManagementContext.Provider>
	);
}
