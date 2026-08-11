"use client";

import { isContentLanguage } from "@rezics/i18n";
import {
	type GetApiPostsByPostIdStatus200,
	useGetApiPostsByPostId,
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
import { BookOpenText, Globe2, History, Link2, ShieldCheck } from "lucide-react";
import { AppLink as Link } from "@/features/application-shell/components/app-link";
import { usePathname, useSearchParams } from "next/navigation";
import { createContext, useContext, type ReactNode } from "react";

import { RequireSession } from "@/features/auth/require-session";
import { ContentLanguageEditorBoundary } from "@/features/content-languages/components/content-language-editor-boundary";
import { useTranslation } from "@/i18n/client";
import { useLocalizationLanguages } from "@/i18n/use-localization-languages";
import {
	canOpenPostManagement,
	getPostManagementSectionIds,
	type PostManagementSectionId,
} from "../model/post-management-section";
import { resolvePostPresentationTitle } from "../model/post-presentation-title";
import {
	parsePostManagementSection,
	postDetailHref,
	postManagementHref,
	postManagementSectionHref,
} from "../routing/post-management-routes";

type ReviewManagementResource = Readonly<{
	item: Extract<GetApiPostsByPostIdStatus200, { postKind: "review" }>;
}>;

type PostManagementResource = Readonly<{ item: GetApiPostsByPostIdStatus200 }>;

interface PostManagementContextValue {
	resource: PostManagementResource;
}

const PostManagementContext = createContext<PostManagementContextValue | undefined>(undefined);

export function usePostManagement(): PostManagementContextValue {
	const value = useContext(PostManagementContext);
	if (!value) throw new Error("Post management context is unavailable outside its workspace");
	return value;
}

export function useReviewManagement(): ReviewManagementResource {
	const { resource } = usePostManagement();
	if (resource.item.postKind !== "review")
		throw new Error("Review management is unavailable in an ordinary Post workspace");
	return { item: resource.item };
}

export function PostManagementWorkspace({
	postId,
	children,
}: {
	postId: string;
	children: ReactNode;
}) {
	return (
		<RequireSession>
			<PostManagementWorkspaceLoader postId={postId}>{children}</PostManagementWorkspaceLoader>
		</RequireSession>
	);
}

function PostManagementWorkspaceLoader({
	postId,
	children,
}: {
	postId: string;
	children: ReactNode;
}) {
	const localizationLanguages = useLocalizationLanguages();
	const searchParams = useSearchParams();
	const requestedLanguage = searchParams.get("language");
	const editorLocalizationLanguages =
		requestedLanguage && isContentLanguage(requestedLanguage)
			? [
					requestedLanguage,
					...localizationLanguages.filter((language) => language !== requestedLanguage),
				]
			: localizationLanguages;
	const postQuery = useGetApiPostsByPostId({
		path: { postId },
		query: { localizationLanguages: editorLocalizationLanguages },
	});

	if (postQuery.isError)
		return <QueryFailure error={postQuery.error} retry={() => void postQuery.refetch()} />;
	if (!postQuery.data) return <QueryPending />;
	return (
		<ContentLanguageEditorBoundary
			onLanguagesChanged={async () => {
				await postQuery.refetch();
			}}
			unitId={postId}
		>
			<LoadedPostManagementWorkspace resource={{ item: postQuery.data }} children={children} />
		</ContentLanguageEditorBoundary>
	);
}

function LoadedPostManagementWorkspace({
	resource,
	children,
}: {
	resource: PostManagementResource;
	children: ReactNode;
}) {
	const pathname = usePathname();
	const { t } = useTranslation(["errors", "posts", "ui", "units"]);
	if (!canOpenPostManagement(resource.item))
		return (
			<main className="mx-auto grid min-h-64 w-full max-w-4xl place-items-center px-4 py-10">
				<p className="text-sm text-destructive">{t.errors.forbidden}</p>
			</main>
		);

	const postId = resource.item.id;
	const mainDescription =
		resource.item.postKind === "review"
			? t.posts.workspace.sections.main.reviewDescription
			: resource.item.postKind === "reply"
				? t.posts.workspace.sections.main.replyDescription
				: t.posts.workspace.sections.main.postDescription;
	const allSections: ManagementWorkspaceSection<PostManagementSectionId>[] = [
		{
			id: "main",
			href: postManagementHref(postId),
			label: t.posts.workspace.sections.main.label,
			description: mainDescription,
			icon: BookOpenText,
		},
		{
			id: "attributions",
			href: postManagementSectionHref(postId, "attributions"),
			label: t.posts.workspace.sections.attributions.label,
			description: t.posts.workspace.sections.attributions.description,
			icon: Link2,
		},
		{
			id: "realms",
			href: postManagementSectionHref(postId, "realms"),
			label: t.units.workspace.sections.realms.label,
			description: t.units.workspace.sections.realms.description,
			icon: Globe2,
		},
		{
			id: "access",
			href: postManagementSectionHref(postId, "access"),
			label: t.units.workspace.sections.access.label,
			description: t.units.workspace.sections.access.description,
			icon: ShieldCheck,
		},
		{
			id: "history",
			href: postManagementSectionHref(postId, "history"),
			label: t.units.workspace.sections.history.label,
			description: t.units.workspace.sections.history.description,
			icon: History,
		},
	];
	const visibleSectionIds = new Set(getPostManagementSectionIds(resource.item));
	const sections = allSections.filter(({ id }) => visibleSectionIds.has(id));
	const currentSectionId = parsePostManagementSection(pathname, postId);
	const requestedSection = allSections.find(({ id }) => id === currentSectionId);
	const sectionAllowed = currentSectionId !== undefined && visibleSectionIds.has(currentSectionId);
	const title =
		resolvePostPresentationTitle(resource.item, {
			reviewOf: t.posts.reviewFallbackTitle,
			reply: t.posts.replyPost,
			unknownAttribution: t.posts.unknownAttribution,
			unnamedSubject: t.ui.unnamed,
		})?.value ?? t.posts.untitled;
	const navigation = (
		<ManagementWorkspaceNavigation
			ariaLabel={t.posts.workspace.navigation}
			currentSectionId={sectionAllowed ? currentSectionId : undefined}
			link={Link}
			sections={sections}
		/>
	);

	return (
		<PostManagementContext.Provider value={{ resource }}>
			<ManagementWorkspace
				header={
					<ManagementWorkspaceHeader
						backHref={postDetailHref(postId)}
						backLabel={t.posts.workspace.backToContent}
						description={t.posts.workspace.description}
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
							backHref={postManagementHref(postId)}
							backLabel={t.posts.workspace.sections.main.label}
							description={requestedSection.description}
							link={Link}
							showBackOnMobile={false}
							title={requestedSection.label}
						/>
						<p className="text-sm text-destructive">{t.errors.forbidden}</p>
					</section>
				) : null}
			</ManagementWorkspace>
		</PostManagementContext.Provider>
	);
}
