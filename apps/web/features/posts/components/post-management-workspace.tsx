"use client";

import { isContentLanguage } from "@rezics/i18n";
import {
	type GetApiPostsByPostIdStatus200,
	type GetApiReviewsByReviewIdStatus200,
	useGetApiPostsByPostId,
	useGetApiReviewsByReviewId,
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
import { BookOpenText, History, Link2, ShieldCheck } from "lucide-react";
import Link from "next/link";
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
import {
	parsePostManagementSection,
	postDetailHref,
	postManagementHref,
	postManagementSectionHref,
	type PostManagementResourceKind,
} from "../routing/post-management-routes";

type OrdinaryPostManagementResource = Readonly<{
	kind: "post";
	item: GetApiPostsByPostIdStatus200;
}>;

type ReviewManagementResource = Readonly<{
	kind: "review";
	item: GetApiReviewsByReviewIdStatus200;
}>;

type PostManagementResource = OrdinaryPostManagementResource | ReviewManagementResource;

interface PostManagementContextValue {
	resource: PostManagementResource;
}

const PostManagementContext = createContext<PostManagementContextValue | undefined>(undefined);

export function usePostManagement(): PostManagementContextValue {
	const value = useContext(PostManagementContext);
	if (!value) throw new Error("Post management context is unavailable outside its workspace");
	return value;
}

export function useOrdinaryPostManagement(): OrdinaryPostManagementResource {
	const { resource } = usePostManagement();
	if (resource.kind !== "post")
		throw new Error("Ordinary Post management is unavailable in a Review workspace");
	return resource;
}

export function useReviewManagement(): ReviewManagementResource {
	const { resource } = usePostManagement();
	if (resource.kind !== "review")
		throw new Error("Review management is unavailable in an ordinary Post workspace");
	return resource;
}

export function PostManagementWorkspace({
	kind,
	postId,
	children,
}: {
	kind: PostManagementResourceKind;
	postId: string;
	children: ReactNode;
}) {
	return (
		<RequireSession>
			<PostManagementWorkspaceLoader kind={kind} postId={postId}>
				{children}
			</PostManagementWorkspaceLoader>
		</RequireSession>
	);
}

function PostManagementWorkspaceLoader({
	kind,
	postId,
	children,
}: {
	kind: PostManagementResourceKind;
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
	const postQuery = useGetApiPostsByPostId(
		{ path: { postId }, query: { localizationLanguages: editorLocalizationLanguages } },
		{ query: { enabled: kind === "post" } },
	);
	const reviewQuery = useGetApiReviewsByReviewId(
		{
			path: { reviewId: postId },
			query: { localizationLanguages: editorLocalizationLanguages },
		},
		{ query: { enabled: kind === "review" } },
	);

	if (kind === "post") {
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
				<LoadedPostManagementWorkspace
					resource={{ kind, item: postQuery.data }}
					children={children}
				/>
			</ContentLanguageEditorBoundary>
		);
	}

	if (reviewQuery.isError)
		return <QueryFailure error={reviewQuery.error} retry={() => void reviewQuery.refetch()} />;
	if (!reviewQuery.data) return <QueryPending />;
	return (
		<ContentLanguageEditorBoundary
			onLanguagesChanged={async () => {
				await reviewQuery.refetch();
			}}
			unitId={postId}
		>
			<LoadedPostManagementWorkspace
				resource={{ kind, item: reviewQuery.data }}
				children={children}
			/>
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
	const { t } = useTranslation(["engagement", "errors", "posts", "units"]);
	const capabilitySource =
		resource.kind === "post"
			? { kind: resource.kind, capabilities: resource.item.capabilities }
			: { kind: resource.kind, capabilities: resource.item.capabilities };
	if (!canOpenPostManagement(capabilitySource))
		return (
			<main className="mx-auto grid min-h-64 w-full max-w-4xl place-items-center px-4 py-10">
				<p className="text-sm text-destructive">{t.errors.forbidden}</p>
			</main>
		);

	const postId = resource.item.id;
	const mainDescription =
		resource.kind === "review"
			? t.posts.workspace.sections.main.reviewDescription
			: resource.item.postKind === "reply"
				? t.posts.workspace.sections.main.replyDescription
				: t.posts.workspace.sections.main.postDescription;
	const allSections: ManagementWorkspaceSection<PostManagementSectionId>[] = [
		{
			id: "main",
			href: postManagementHref(resource.kind, postId),
			label: t.posts.workspace.sections.main.label,
			description: mainDescription,
			icon: BookOpenText,
		},
		{
			id: "attributions",
			href: postManagementSectionHref(resource.kind, postId, "attributions"),
			label: t.posts.workspace.sections.attributions.label,
			description: t.posts.workspace.sections.attributions.description,
			icon: Link2,
		},
		{
			id: "access",
			href: postManagementSectionHref(resource.kind, postId, "access"),
			label: t.units.workspace.sections.access.label,
			description: t.units.workspace.sections.access.description,
			icon: ShieldCheck,
		},
		{
			id: "history",
			href: postManagementSectionHref(resource.kind, postId, "history"),
			label: t.units.workspace.sections.history.label,
			description: t.units.workspace.sections.history.description,
			icon: History,
		},
	];
	const visibleSectionIds = new Set(getPostManagementSectionIds(capabilitySource));
	const sections = allSections.filter(({ id }) => visibleSectionIds.has(id));
	const currentSectionId = parsePostManagementSection(pathname, resource.kind, postId);
	const requestedSection = allSections.find(({ id }) => id === currentSectionId);
	const sectionAllowed =
		currentSectionId !== undefined && visibleSectionIds.has(currentSectionId);
	const title =
		resource.item.title ??
		(resource.kind === "review"
			? t.engagement.editReview
			: resource.item.postKind === "reply"
				? t.posts.replyPost
				: t.posts.untitled);
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
						backHref={postDetailHref(resource.kind, postId)}
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
							backHref={postManagementHref(resource.kind, postId)}
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
