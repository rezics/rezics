"use client";

import type { ManagementWorkspaceSection } from "@rezics/ui";
import {
	ManagementWorkspace,
	ManagementWorkspaceHeader,
	ManagementWorkspaceNavigation,
} from "@rezics/ui";
import {
	BookOpen,
	Clapperboard,
	ClipboardPenLine,
	Code2,
	Folder,
	FileText,
	Landmark,
	MessageSquareText,
	PanelsTopLeft,
	Shapes,
	Tags,
	Vote,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useContext, type ReactNode } from "react";

import { RequireSession } from "@/features/auth/require-session";
import { useTranslation } from "@/i18n/client";
import type { StudioSectionId } from "../model/studio-section";
import { parseStudioSection, studioSectionHref } from "../routing/studio-routes";

const StudioSectionsContext = createContext<
	readonly ManagementWorkspaceSection<StudioSectionId>[] | undefined
>(undefined);

export function useStudioWorkspaceSections() {
	const sections = useContext(StudioSectionsContext);
	if (!sections) throw new Error("Studio sections must be used inside StudioWorkspace");
	return sections;
}

export function StudioWorkspace({ children }: { readonly children: ReactNode }) {
	const pathname = usePathname();
	const { t } = useTranslation(["create"]);
	const labels = t.create.sections;
	const sections = [
		{
			id: "book",
			href: studioSectionHref("book"),
			label: labels.book.label,
			description: labels.book.description,
			icon: BookOpen,
		},
		{
			id: "software",
			href: studioSectionHref("software"),
			label: labels.software.label,
			description: labels.software.description,
			icon: Code2,
		},
		{
			id: "media",
			href: studioSectionHref("media"),
			label: labels.media.label,
			description: labels.media.description,
			icon: Clapperboard,
		},
		{
			id: "entity",
			href: studioSectionHref("entity"),
			label: labels.entity.label,
			description: labels.entity.description,
			icon: Shapes,
		},
		{
			id: "tag",
			href: studioSectionHref("tag"),
			label: labels.tag.label,
			description: labels.tag.description,
			icon: Tags,
		},
		{
			id: "realm",
			href: studioSectionHref("realm"),
			label: labels.realm.label,
			description: labels.realm.description,
			icon: Landmark,
		},
		{
			id: "zone",
			href: studioSectionHref("zone"),
			label: labels.zone.label,
			description: labels.zone.description,
			icon: PanelsTopLeft,
			badge: t.create.developmentBadge,
		},
		{
			id: "post",
			href: studioSectionHref("post"),
			label: labels.post.label,
			description: labels.post.description,
			icon: MessageSquareText,
		},
		{
			id: "wiki",
			href: studioSectionHref("wiki"),
			label: labels.wiki.label,
			description: labels.wiki.description,
			icon: FileText,
		},
		{
			id: "collection",
			href: studioSectionHref("collection"),
			label: labels.collection.label,
			description: labels.collection.description,
			icon: Folder,
		},
		{
			id: "review",
			href: studioSectionHref("review"),
			label: labels.review.label,
			description: labels.review.description,
			icon: ClipboardPenLine,
		},
		{
			id: "poll",
			href: studioSectionHref("poll"),
			label: labels.poll.label,
			description: labels.poll.description,
			icon: Vote,
		},
	] as const satisfies readonly ManagementWorkspaceSection<StudioSectionId>[];

	return (
		<RequireSession>
			<StudioSectionsContext.Provider value={sections}>
				<ManagementWorkspace
					header={
						<ManagementWorkspaceHeader
							backHref="/"
							backLabel={t.create.workspace.backToApplication}
							description={t.create.workspace.description}
							link={Link}
							title={t.create.workspace.title}
						/>
					}
					navigation={
						<ManagementWorkspaceNavigation
							ariaLabel={t.create.workspace.navigation}
							currentSectionId={parseStudioSection(pathname)}
							link={Link}
							sections={sections}
						/>
					}
				>
					{children}
				</ManagementWorkspace>
			</StudioSectionsContext.Provider>
		</RequireSession>
	);
}
