"use client";

import {
	type GetApiTagsByTagIdStatus200,
	useGetApiTagsByTagId,
} from "@rezics/openapi-tanstack-query";
import type { ManagementWorkspaceSection } from "@rezics/ui";
import {
	ManagementWorkspace,
	ManagementWorkspaceHeader,
	ManagementWorkspaceNavigation,
	QueryFailure,
	QueryPending,
} from "@rezics/ui";
import { FileText } from "lucide-react";
import { usePathname } from "next/navigation";
import { createContext, useContext, type ReactNode } from "react";

import { AppLink as Link } from "@/features/application-shell/components/app-link";
import { RequireSession } from "@/features/auth/require-session";
import { ContentLanguageEditorProvider } from "@/features/content-languages/hooks/use-content-language-editor";
import { useTranslation } from "@/i18n/client";
import { useLocalizationLanguages } from "@/i18n/use-localization-languages";
import { selectLocalization } from "@/lib/localization";
import type { TagManagementSectionId } from "../model/tag-management-section";
import { parseTagManagementSection, tagDetailHref, tagManagementHref } from "../routing/tag-links";

interface TagManagementContextValue {
	readonly tag: GetApiTagsByTagIdStatus200;
	readonly sections: readonly ManagementWorkspaceSection<TagManagementSectionId>[];
}

const TagManagementContext = createContext<TagManagementContextValue | undefined>(undefined);

export function useTagManagement(): TagManagementContextValue {
	const value = useContext(TagManagementContext);
	if (!value) throw new Error("Tag management content must be rendered inside its workspace");
	return value;
}

export function TagManagementWorkspace({
	children,
	tagId,
}: {
	readonly children: ReactNode;
	readonly tagId: string;
}) {
	return (
		<RequireSession>
			<TagManagementWorkspaceContent tagId={tagId}>{children}</TagManagementWorkspaceContent>
		</RequireSession>
	);
}

function TagManagementWorkspaceContent({
	children,
	tagId,
}: {
	readonly children: ReactNode;
	readonly tagId: string;
}) {
	const { t } = useTranslation(["errors", "tags"]);
	const pathname = usePathname();
	const localizationLanguages = useLocalizationLanguages();
	const query = useGetApiTagsByTagId({
		path: { tagId },
		query: { localizationLanguages },
	});
	if (query.isPending) return <QueryPending />;
	if (query.isError || !query.data)
		return <QueryFailure error={query.error} retry={() => void query.refetch()} />;
	if (!query.data.capabilities.canEdit)
		return (
			<main className="mx-auto grid min-h-64 w-full max-w-4xl place-items-center px-4 py-10">
				<p className="text-sm text-destructive">{t.errors.forbidden}</p>
			</main>
		);
	const localization = selectLocalization(query.data.localizations, query.data.language);
	const sections: readonly ManagementWorkspaceSection<TagManagementSectionId>[] = [
		{
			id: "content",
			href: tagManagementHref(tagId, "content"),
			label: t.tags.detail.editTitle,
			description: t.tags.detail.editDescription,
			icon: FileText,
		},
	];
	const navigation = (
		<ManagementWorkspaceNavigation
			ariaLabel={t.tags.detail.editNavigation}
			currentSectionId={parseTagManagementSection(pathname, tagId)}
			link={Link}
			sections={sections}
		/>
	);
	return (
		<ContentLanguageEditorProvider
			localizations={query.data.localizations}
			onLanguagesChanged={async () => {
				await query.refetch();
			}}
			unitId={tagId}
		>
			<TagManagementContext.Provider value={{ tag: query.data, sections }}>
				<ManagementWorkspace
					header={
						<ManagementWorkspaceHeader
							backHref={tagDetailHref(tagId)}
							backLabel={t.tags.detail.backToTag}
							description={t.tags.detail.editDescription}
							link={Link}
							title={localization?.title ?? t.tags.unnamedTag}
						/>
					}
					mobileNavigation={navigation}
					navigation={navigation}
				>
					{children}
				</ManagementWorkspace>
			</TagManagementContext.Provider>
		</ContentLanguageEditorProvider>
	);
}
