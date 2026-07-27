"use client";

import {
	type GetApiCollectionsByCollectionIdStatus200,
	useGetApiCollectionsByCollectionId,
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
	LayoutTemplate,
	ListTree,
	ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useContext, type ReactNode } from "react";

import { RequireSession } from "@/features/auth/require-session";
import { useTranslation } from "@/i18n/client";
import { useLocalizationLanguages } from "@/i18n/use-localization-languages";
import { selectLocalization } from "@/lib/localization";
import {
	canOpenCollectionManagement,
	getCollectionManagementSectionIds,
	type CollectionManagementSectionId,
} from "../model/collection-management-section";
import {
	collectionHref,
	collectionManagementHref,
	collectionManagementSectionHref,
	parseCollectionManagementSection,
} from "../routing/collection-management-routes";

interface CollectionManagementContextValue {
	readonly collection: GetApiCollectionsByCollectionIdStatus200;
	readonly sections: readonly ManagementWorkspaceSection<CollectionManagementSectionId>[];
}

const CollectionManagementContext = createContext<CollectionManagementContextValue | undefined>(
	undefined,
);

export function useCollectionManagement(): CollectionManagementContextValue {
	const value = useContext(CollectionManagementContext);
	if (!value)
		throw new Error("Collection management context is unavailable outside its workspace");
	return value;
}

export function CollectionManagementWorkspace({
	children,
	collectionId,
}: {
	readonly children: ReactNode;
	readonly collectionId: string;
}) {
	return (
		<RequireSession>
			<CollectionManagementWorkspaceContent collectionId={collectionId}>
				{children}
			</CollectionManagementWorkspaceContent>
		</RequireSession>
	);
}

function CollectionManagementWorkspaceContent({
	children,
	collectionId,
}: {
	readonly children: ReactNode;
	readonly collectionId: string;
}) {
	const pathname = usePathname();
	const localizationLanguages = useLocalizationLanguages();
	const query = useGetApiCollectionsByCollectionId({
		path: { collectionId },
		query: { localizationLanguages },
	});
	const { t } = useTranslation(["collections", "errors", "ui"]);
	if (query.isPending) return <QueryPending />;
	if (query.isError)
		return <QueryFailure error={query.error} retry={() => void query.refetch()} />;
	const collection = query.data;
	if (!canOpenCollectionManagement(collection.capabilities))
		return (
			<main className="mx-auto grid min-h-64 w-full max-w-4xl place-items-center px-4 py-10">
				<p className="text-sm text-destructive">{t.errors.forbidden}</p>
			</main>
		);
	const labels = t.collections.workspace.sections;
	const allSections: ManagementWorkspaceSection<CollectionManagementSectionId>[] = [
		{
			id: "basic",
			href: collectionManagementSectionHref(collectionId, "basic"),
			label: labels.basic.label,
			description: labels.basic.description,
			icon: BookOpenText,
		},
		{
			id: "localizations",
			href: collectionManagementSectionHref(collectionId, "localizations"),
			label: labels.localizations.label,
			description: labels.localizations.description,
			icon: Languages,
		},
		{
			id: "items",
			href: collectionManagementSectionHref(collectionId, "items"),
			label: labels.items.label,
			description: labels.items.description,
			icon: ListTree,
		},
		{
			id: "presentation",
			href: collectionManagementSectionHref(collectionId, "presentation"),
			label: labels.presentation.label,
			description: labels.presentation.description,
			icon: LayoutTemplate,
		},
		{
			id: "access",
			href: collectionManagementSectionHref(collectionId, "access"),
			label: labels.access.label,
			description: labels.access.description,
			icon: ShieldCheck,
		},
		{
			id: "history",
			href: collectionManagementSectionHref(collectionId, "history"),
			label: labels.history.label,
			description: labels.history.description,
			icon: History,
		},
	];
	const visibleSectionIds = new Set(getCollectionManagementSectionIds(collection.capabilities));
	const sections = allSections.filter(({ id }) => visibleSectionIds.has(id));
	const currentSectionId = parseCollectionManagementSection(pathname, collectionId);
	const requestedSection = allSections.find(({ id }) => id === currentSectionId);
	const sectionAllowed =
		currentSectionId === undefined || visibleSectionIds.has(currentSectionId);
	const localization = selectLocalization(collection.localizations, collection.language);
	const title =
		collection.systemKey === "favorites"
			? t.collections.favorites
			: (localization?.title ?? t.collections.workspace.title);
	const navigation = (
		<ManagementWorkspaceNavigation
			ariaLabel={t.collections.workspace.navigation}
			currentSectionId={sectionAllowed ? currentSectionId : undefined}
			link={Link}
			sections={sections}
		/>
	);
	return (
		<CollectionManagementContext.Provider value={{ collection, sections }}>
			<ManagementWorkspace
				header={
					<ManagementWorkspaceHeader
						backHref={collectionHref(collectionId)}
						backLabel={t.collections.workspace.backToCollection}
						description={t.collections.workspace.description}
						link={Link}
						title={title}
					/>
				}
				mobileNavigation={navigation}
				navigation={navigation}
			>
				{sectionAllowed ? (
					children
				) : requestedSection ? (
					<section>
						<ManagementWorkspaceSectionHeader
							backHref={collectionManagementHref(collectionId)}
							backLabel={t.collections.workspace.backToOverview}
							description={requestedSection.description}
							link={Link}
							showBackOnMobile={false}
							title={requestedSection.label}
						/>
						<p className="text-sm text-destructive">{t.errors.forbidden}</p>
					</section>
				) : null}
			</ManagementWorkspace>
		</CollectionManagementContext.Provider>
	);
}
