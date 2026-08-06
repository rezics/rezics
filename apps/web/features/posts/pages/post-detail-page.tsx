"use client";

import {
	type GetApiPostsByPostIdStatus200,
	useGetApiChaptersByChapterId,
	useGetApiPostsByPostId,
} from "@rezics/openapi-tanstack-query";
import { useApplicationRouter } from "@/features/application-shell/hooks/use-application-router";
import { useRequestedContentLanguage } from "@/features/content-languages/hooks/use-content-language-navigation";
import { withContentLanguage } from "@/features/content-languages/routing/content-language-route";
import { useEffect, type ReactNode } from "react";
import { ArrowLeft } from "lucide-react";

import { Button, cn, QueryFailure, QueryPending } from "@rezics/ui";
import { AppLink as Link } from "@/features/application-shell/components/app-link";
import { UnitDockRenderer } from "@/features/docks";
import { ReviewPostDetail } from "@/features/reviews/components/review-post-detail";
import { useTranslation } from "@/i18n/client";
import { useLocalizationFallbackToast } from "@/i18n/use-localization-fallback-toast";
import { useLocalizationLanguages } from "@/i18n/use-localization-languages";
import { hasErrorCode } from "@/i18n/errors";
import { PostDetailArticle } from "../components/post-detail-article";
import { getPublisherUnitIds } from "../attribution-list";
import { PostOverflowMenu } from "../components/post-overflow-menu";
import {
	PostRealmContextBar,
	PostRealmContextCard,
	PostRealmContextSelector,
} from "../components/post-realm-context";
import { PostSubjectHero } from "../components/post-subject-hero";
import { usePostDetailContext } from "../data/post-detail-context";
import { getPostManagementSectionIds } from "../model/post-management-section";
import {
	resolvePostRealmContext,
	type PostRealmContextSelection,
} from "../model/post-realm-context";
import { resolvePostPresentationTitle } from "../model/post-presentation-title";
import { RelatedPostRecommendations } from "../post-list";
import { ReplyPostThread } from "../reply-thread";
import { postManagementSectionHref } from "../routing/post-management-routes";
import { postHref, type PostInteractionContext } from "../url";
import { isUnitDetailUnitType } from "@/features/units/model/unit-detail-section";
import { unitDetailHref } from "@/features/units/routing/unit-detail-routes";

type WikiPost = Extract<GetApiPostsByPostIdStatus200, { postKind: "wiki" }>;

/**
 * Resolves chapter IDs before rendering the generic post surface.
 *
 * @remarks
 * The current chapter API returns one readable Book context. This keeps the
 * existing Global, Realm, and Zone post entry points compatible while the
 * multi-Book context contract is still pending.
 *
 * @todo When feed items expose the resolved Book content-structure context,
 * build the Reader URL directly from the Feed card and remove this lookup.
 * @todo When the chapter API returns multiple Book contexts, render a Book
 * context selector instead of selecting the current single returned context.
 */
export function PostDetailPage({
	context,
	id,
	renderWikiBody,
	returnToDiscussion = false,
}: {
	readonly context?: PostInteractionContext;
	readonly id: string;
	readonly renderWikiBody?: (post: WikiPost) => ReactNode;
	readonly returnToDiscussion?: boolean;
}) {
	const { t } = useTranslation(["posts", "ui", "units"]);
	const localizationLanguages = useLocalizationLanguages();
	const requestedLanguage = useRequestedContentLanguage();
	const router = useApplicationRouter();
	const requestedRealmId = context?.kind === "realm" ? context.realmId : undefined;
	const chapterQuery = useGetApiChaptersByChapterId({
		path: { chapterId: id },
		query: { localizationLanguages },
	});
	const query = useGetApiPostsByPostId({
		path: { postId: id },
		query: {
			...(requestedRealmId ? { realmId: requestedRealmId } : {}),
			localizationLanguages,
		},
	});
	useLocalizationFallbackToast({
		actualLanguage: query.data?.language ?? null,
		localizationLanguages,
		unitId: id,
	});
	const contextQuery = usePostDetailContext(id);
	const realms = contextQuery.data?.realms ?? [];
	const hasRealmContext = context?.kind !== "zone";
	const realmContext = resolvePostRealmContext(realms, requestedRealmId);
	const selectedRealm = realmContext.kind === "realm" ? realmContext.realm : undefined;
	const realmId = selectedRealm?.id;
	const wikiZone =
		query.data?.postKind === "wiki" && query.data.subject?.type === "zone"
			? query.data.subject
			: undefined;
	const chapterBookId = chapterQuery.data?.bookId;
	const chapterId = chapterQuery.data?.chapterId;
	useEffect(() => {
		if (!chapterBookId || !chapterId) return;
		router.replace(
			withContentLanguage(
				`/units/book/${chapterBookId}/read/${chapterId}`,
				requestedLanguage,
			),
			{ scroll: false },
		);
	}, [chapterBookId, chapterId, requestedLanguage, router]);
	useEffect(() => {
		if (wikiZone && context?.kind !== "zone") {
			router.replace(
				withContentLanguage(
					postHref(id, { kind: "zone", zone: { id: wikiZone.id } }),
					requestedLanguage,
				),
			);
			return;
		}
		if (
			context?.kind === "realm" &&
			contextQuery.data !== undefined &&
			realmContext.kind === "global"
		)
			router.replace(withContentLanguage(postHref(id), requestedLanguage), {
				scroll: false,
			});
	}, [
		context?.kind,
		contextQuery.data,
		id,
		realmContext.kind,
		requestedLanguage,
		router,
		wikiZone,
	]);

	if (chapterQuery.isPending || chapterQuery.data) return <QueryPending />;
	if (chapterQuery.isError && !hasErrorCode(chapterQuery.error, "ChapterNotFound"))
		return (
			<QueryFailure error={chapterQuery.error} retry={() => void chapterQuery.refetch()} />
		);
	if (query.isError)
		return <QueryFailure error={query.error} retry={() => void query.refetch()} />;
	if (hasRealmContext && contextQuery.isError)
		return (
			<QueryFailure error={contextQuery.error} retry={() => void contextQuery.refetch()} />
		);
	if (!query.data || (hasRealmContext && contextQuery.data === undefined))
		return <QueryPending />;
	const post = query.data;
	const postPublisherUnitIds = getPublisherUnitIds(post.attributions);
	const discussionHref =
		returnToDiscussion && post.subject && isUnitDetailUnitType(post.subject.type)
			? unitDetailHref(post.subject.type, post.subject.id, "discussion")
			: undefined;
	if (wikiZone && context?.kind !== "zone") return <QueryPending />;
	const changeRealm = (nextContext: PostRealmContextSelection) => {
		if (
			nextContext.kind === realmContext.kind &&
			(nextContext.kind === "global" || nextContext.realm.id === selectedRealm?.id)
		)
			return;
		router.replace(
			withContentLanguage(
				nextContext.kind === "global"
					? postHref(post.id)
					: postHref(post.id, { kind: "realm", realmId: nextContext.realm.id }),
				requestedLanguage,
			),
			{
				scroll: false,
			},
		);
	};
	const mobileRealmContext = hasRealmContext ? (
		<div className="grid gap-3 border-border-weak border-y py-4 lg:hidden">
			<PostRealmContextSelector
				onValueChange={changeRealm}
				realms={realms}
				value={realmContext}
			/>
			{selectedRealm ? (
				<UnitDockRenderer
					ownerUnitId={selectedRealm.id}
					target={{ ownerKind: "realm", dockKind: "main" }}
				/>
			) : null}
		</div>
	) : null;
	const desktopRealmContext = hasRealmContext ? (
		<aside className="sticky top-20 hidden min-w-0 flex-col gap-3 lg:flex">
			<PostRealmContextSelector
				onValueChange={changeRealm}
				realms={realms}
				value={realmContext}
			/>
			{selectedRealm ? (
				<>
					<PostRealmContextCard realm={selectedRealm} />
					<UnitDockRenderer
						ownerUnitId={selectedRealm.id}
						target={{ ownerKind: "realm", dockKind: "main" }}
					/>
				</>
			) : null}
		</aside>
	) : null;

	if (post.postKind === "review")
		return (
			<main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-6 sm:px-6 sm:py-8">
				{selectedRealm ? (
					<PostRealmContextBar realm={selectedRealm} />
				) : !hasRealmContext && discussionHref ? (
					<Button asChild className="w-fit" variant="outline">
						<Link href={discussionHref}>
							<ArrowLeft aria-hidden />
							{t.units.detail.backToDiscussion}
						</Link>
					</Button>
				) : null}
				{post.subject ? <PostSubjectHero subject={post.subject} /> : null}
				<div
					className={cn(
						"grid min-w-0 items-start gap-10",
						hasRealmContext && "lg:grid-cols-[minmax(0,1fr)_19rem]",
					)}
				>
					<div className="flex min-w-0 flex-col gap-8">
						<ReviewPostDetail review={post} />
						{mobileRealmContext}
						<ReplyPostThread
							canReply={post.capabilities.canReply}
							postPublisherUnitIds={postPublisherUnitIds}
							realmId={realmId}
							rootPostId={post.id}
						/>
						<RelatedPostRecommendations postId={post.id} />
					</div>
					{desktopRealmContext}
				</div>
			</main>
		);
	const title = resolvePostPresentationTitle(post, {
		postBy: t.posts.postFallbackTitle,
		reviewOf: t.posts.reviewFallbackTitle,
		reply: t.posts.replyPost,
		unknownAttribution: t.posts.unknownAttribution,
		unnamedSubject: t.ui.unnamed,
		untitled: t.posts.untitled,
	});
	const managementSectionId = getPostManagementSectionIds(post)[0];

	return (
		<main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-6 sm:px-6 sm:py-8">
			{selectedRealm ? (
				<PostRealmContextBar realm={selectedRealm} />
			) : !hasRealmContext && discussionHref ? (
				<Button asChild className="w-fit" variant="outline">
					<Link href={discussionHref}>
						<ArrowLeft aria-hidden />
						{t.units.detail.backToDiscussion}
					</Link>
				</Button>
			) : null}
			{post.subject ? <PostSubjectHero subject={post.subject} /> : null}
			<div
				className={cn(
					"grid min-w-0 items-start gap-10",
					hasRealmContext && "lg:grid-cols-[minmax(0,1fr)_19rem]",
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
								availableLanguages={post.availableLanguages}
								currentLanguage={post.language}
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
								realmId={realmId}
							/>
						}
						commentsHref="#replies"
						post={{
							id: post.id,
							postKind: post.postKind,
							attributions: post.attributions,
							realmId: realmId ?? null,
							language: post.language,
							title: title.value,
							titleLanguage: title.language ?? null,
							summary: post.summary,
							body: post.body,
							createdAt: post.createdAt,
						}}
						replyCount={Number(post.replyCount)}
						variant="thread"
					/>
					{mobileRealmContext}
					<ReplyPostThread
						canReply={post.capabilities.canReply}
						parentPostId={post.postKind === "reply" ? post.id : undefined}
						postPublisherUnitIds={postPublisherUnitIds}
						realmId={realmId}
						rootPostId={post.rootPostId ?? post.id}
					/>
					<RelatedPostRecommendations postId={post.id} />
				</div>
				{desktopRealmContext}
			</div>
		</main>
	);
}
