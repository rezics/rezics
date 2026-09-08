"use client";

import type { ManagementWorkspaceSection } from "@rezics/ui";
import {
	ManagementWorkspace,
	ManagementWorkspaceHeader,
	ManagementWorkspaceNavigation,
} from "@rezics/ui";
import {
	BookOpen,
	Music2,
	Network,
	Library,
	Package,
	Video,
	AudioLines,
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
import { AppLink as Link } from "@/features/application-shell/components/app-link";
import { usePathname } from "next/navigation";
import { createContext, useContext, type ReactNode } from "react";

import { RequireSession } from "@/features/auth/require-session";
import { useTranslation } from "@/i18n/client";
import { StudioSectionIds, type StudioSectionId } from "../model/studio-section";
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
	const icons = {
		publishing: BookOpen,
		music: Music2,
		program: Clapperboard,
		software: Code2,
		entity: Shapes,
		grouping: Network,
		reference: Library,
		distribution: Package,
		video: Video,
		audio: AudioLines,
		post: MessageSquareText,
		wiki: FileText,
		review: ClipboardPenLine,
		poll: Vote,
		realm: Landmark,
		zone: PanelsTopLeft,
		collection: Folder,
		tag: Tags,
	};
	const sections = StudioSectionIds.map((id) => ({
		id,
		href: studioSectionHref(id),
		label: labels[id].label,
		icon: icons[id],
	})) satisfies readonly ManagementWorkspaceSection<StudioSectionId>[];

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
