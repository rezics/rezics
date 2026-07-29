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
import { BookOpenText, Database, History, Link2, ListTree, ShieldCheck } from "lucide-react";
import { AppLink as Link } from "@/features/application-shell/components/app-link";
import { usePathname } from "next/navigation";
import { createContext, useContext, type ReactNode } from "react";

import { RequireSession } from "@/features/auth/require-session";
import { ContentLanguageEditorProvider } from "@/features/content-languages/hooks/use-content-language-editor";
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
			id: "content",
			href: collectionManagementSectionHref(collectionId, "content"),
			label: labels.content.label,
			description: labels.content.description,
			icon: BookOpenText,
		},
		{
			id: "metadata",
			href: collectionManagementSectionHref(collectionId, "metadata"),
			label: labels.metadata.label,
			description: labels.metadata.description,
			icon: Database,
		},
		{
			id: "items",
			href: collectionManagementSectionHref(collectionId, "items"),
			label: labels.items.label,
			description: labels.items.description,
			icon: ListTree,
		},
		{
			id: "publishers",
			href: collectionManagementSectionHref(collectionId, "publishers"),
			label: labels.publishers.label,
			description: labels.publishers.description,
			icon: Link2,
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
	const sectionAllowed = Boolean(currentSectionId && visibleSectionIds.has(currentSectionId));
	const localization = selectLocalization(collection.localizations, collection.language);
	const title =
		collection.purpose === "favorites"
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
		<ContentLanguageEditorProvider
			localizations={collection.localizations}
			onLanguagesChanged={async () => {
				await query.refetch();
			}}
			unitId={collection.id}
		>
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
								backLabel={t.collections.workspace.backToContent}
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
		</ContentLanguageEditorProvider>
	);
}
