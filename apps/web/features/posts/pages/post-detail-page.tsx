"use client";

import {
	type GetApiPostsByPostIdStatus200,
	useGetApiPostsByPostId,
} from "@rezics/openapi-tanstack-query";
import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";

import { cn, QueryFailure, QueryPending } from "@rezics/ui";
import { UnitDockRenderer } from "@/features/docks";
import { ReviewPostDetail } from "@/features/reviews/components/review-post-detail";
import { useTranslation } from "@/i18n/client";
import { useLocalizationFallbackToast } from "@/i18n/use-localization-fallback-toast";
import { useLocalizationLanguages } from "@/i18n/use-localization-languages";
import { PostDetailArticle } from "../components/post-detail-article";
import { PostOverflowMenu } from "../components/post-overflow-menu";
import {
	PostRealmContextLink,
	PostRealmContextCard,
	PostRealmContextSelector,
} from "../components/post-realm-context";
import { PostSubjectHero } from "../components/post-subject-hero";
import { usePostDetailContext } from "../data/post-detail-context";
import { getPostManagementSectionIds } from "../model/post-management-section";
import { selectPostRealmContext } from "../model/post-realm-context";
import { RelatedPostRecommendations } from "../post-list";
import { ReplyPostThread } from "../reply-thread";
import { postManagementSectionHref } from "../routing/post-management-routes";
import { postHref, type PostInteractionContext } from "../url";

type WikiPost = Extract<GetApiPostsByPostIdStatus200, { postKind: "wiki" }>;

export function PostDetailPage({
	context,
	id,
	renderWikiBody,
}: {
	readonly context?: PostInteractionContext;
	readonly id: string;
	readonly renderWikiBody?: (post: WikiPost) => ReactNode;
}) {
	const { t } = useTranslation(["posts"]);
	const localizationLanguages = useLocalizationLanguages();
	const router = useRouter();
	const realmId = context?.kind === "realm" ? context.realmId : undefined;
	const query = useGetApiPostsByPostId({
		path: { postId: id },
		query: { ...(realmId ? { realmId } : {}), localizationLanguages },
	});
	useLocalizationFallbackToast({
		actualLanguage: query.data?.language ?? null,
		localizationLanguages,
		unitId: id,
	});
	const contextQuery = usePostDetailContext(id);
	const realms = contextQuery.data?.realms ?? [];
	const selectedRealm =
		context?.kind === "zone" ? undefined : selectPostRealmContext(realms, realmId);
	const wikiZone =
		query.data?.postKind === "wiki" && query.data.subject?.type === "zone"
			? query.data.subject
			: undefined;
	useEffect(() => {
		if (!wikiZone || context?.kind === "zone") return;
		router.replace(postHref(id, { kind: "zone", zone: { id: wikiZone.id } }));
	}, [context?.kind, id, router, wikiZone]);

	if (query.isError)
		return <QueryFailure error={query.error} retry={() => void query.refetch()} />;
	if (!query.data) return <QueryPending />;
	const post = query.data;
	if (wikiZone && context?.kind !== "zone") return <QueryPending />;
	if (post.postKind === "review")
		return (
			<main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-6 sm:px-6 sm:py-8">
				{post.subject ? <PostSubjectHero subject={post.subject} /> : null}
				<div className="grid min-w-0 items-start gap-10">
					<div className="flex min-w-0 flex-col gap-8">
						<ReviewPostDetail review={post} />
						<RelatedPostRecommendations postId={post.id} />
					</div>
				</div>
			</main>
		);
	const title = post.postKind === "reply" ? t.posts.replyPost : (post.title ?? t.posts.untitled);
	const managementSectionId = getPostManagementSectionIds(post)[0];
	const changeRealm = (nextRealmId: string) => {
		if (nextRealmId === realmId) return;
		router.replace(postHref(post.id, { kind: "realm", realmId: nextRealmId }), {
			scroll: false,
		});
	};

	return (
		<main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-6 sm:px-6 sm:py-8">
			{post.subject ? <PostSubjectHero subject={post.subject} /> : null}
			<div
				className={cn(
					"grid min-w-0 items-start gap-10",
					selectedRealm && "lg:grid-cols-[minmax(0,1fr)_19rem]",
				)}
			>
				<div className="flex min-w-0 flex-col gap-8">
					<PostDetailArticle
						bodyContent={
							post.postKind === "wiki" && renderWikiBody
								? renderWikiBody(post)
								: undefined
						}
						engagementOverflow={
							<PostOverflowMenu
								canDelete={post.postKind !== "wiki" && post.capabilities.canEdit}
								editAction={
									managementSectionId
										? {
												kind: "link",
												href: postManagementSectionHref(
													post.id,
													managementSectionId,
												),
											}
										: undefined
								}
								postId={post.id}
								rootPostId={post.rootPostId}
							/>
						}
						commentsHref="#replies"
						post={{
							id: post.id,
							postKind: post.postKind,
							attributions: post.attributions,
							realmId: realmId ?? post.realmId,
							language: post.language,
							title,
							body: post.body,
							createdAt: post.createdAt,
							scores: post.scores,
						}}
						replyCount={Number(post.replyCount)}
						variant="thread"
					/>
					{selectedRealm && post.postKind !== "wiki" ? (
						<div className="grid gap-3 border-border-weak border-y py-4 lg:hidden">
							<PostRealmContextSelector
								onValueChange={changeRealm}
								realms={realms}
								value={selectedRealm.id}
							/>
							<PostRealmContextLink realm={selectedRealm} />
							<UnitDockRenderer
								ownerUnitId={selectedRealm.id}
								target={{ ownerKind: "realm", dockKind: "main" }}
							/>
						</div>
					) : null}
					{post.postKind !== "wiki" ? (
						<ReplyPostThread
							canReply={post.capabilities.canReply}
							parentPostId={post.postKind === "reply" ? post.id : undefined}
							realmId={realmId}
							rootPostId={post.rootPostId ?? post.id}
						/>
					) : null}
					<RelatedPostRecommendations postId={post.id} />
				</div>
				{selectedRealm && post.postKind !== "wiki" ? (
					<aside className="sticky top-20 hidden min-w-0 flex-col gap-3 lg:flex">
						<PostRealmContextSelector
							onValueChange={changeRealm}
							realms={realms}
							value={selectedRealm.id}
						/>
						<PostRealmContextCard realm={selectedRealm} />
						<UnitDockRenderer
							ownerUnitId={selectedRealm.id}
							target={{ ownerKind: "realm", dockKind: "main" }}
						/>
					</aside>
				) : null}
			</div>
		</main>
	);
}
