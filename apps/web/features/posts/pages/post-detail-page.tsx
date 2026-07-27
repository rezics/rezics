"use client";

import { useGetApiPostsByPostId } from "@rezics/openapi-tanstack-query";
import { useRouter } from "next/navigation";

import { cn, QueryFailure, QueryPending } from "@rezics/ui";
import { useTranslation } from "@/i18n/client";
import { PostDetailArticle } from "../components/post-detail-article";
import { PostOverflowMenu } from "../components/post-overflow-menu";
import {
	PostRealmContextLink,
	PostRealmContextSelector,
	PostRealmMainDock,
} from "../components/post-realm-context";
import { PostSubjectHero } from "../components/post-subject-hero";
import { usePostDetailContext } from "../data/post-detail-context";
import { canOpenPostManagement } from "../model/post-management-section";
import { selectPostRealmContext } from "../model/post-realm-context";
import { RelatedPostRecommendations } from "../post-list";
import { ReplyPostThread } from "../reply-thread";
import { postHref } from "../url";

export function PostDetailPage({ id, realmId }: { id: string; realmId?: string }) {
	const { t } = useTranslation(["posts"]);
	const router = useRouter();
	const query = useGetApiPostsByPostId({
		path: { postId: id },
		query: { ...(realmId ? { realmId } : {}) },
	});
	const contextQuery = usePostDetailContext(id);
	const realms = contextQuery.data?.realms ?? [];
	const selectedRealm = selectPostRealmContext(realms, realmId);

	if (query.isError)
		return <QueryFailure error={query.error} retry={() => void query.refetch()} />;
	if (!query.data) return <QueryPending />;
	const post = query.data;
	const title = post.postKind === "reply" ? t.posts.replyPost : (post.title ?? t.posts.untitled);
	const canManage = canOpenPostManagement({
		kind: "post",
		capabilities: post.capabilities,
	});
	const changeRealm = (nextRealmId: string) => {
		if (nextRealmId === realmId) return;
		router.replace(postHref(post.id, nextRealmId), { scroll: false });
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
						engagementOverflow={
							<PostOverflowMenu
								canDelete={post.capabilities.canEdit}
								editAction={
									canManage
										? { kind: "link", href: `/posts/${post.id}/edit` }
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
							title,
							body: post.body,
							createdAt: post.createdAt,
							scores: post.scores,
						}}
						replyCount={Number(post.replyCount)}
						variant="thread"
					/>
					{selectedRealm ? (
						<div className="grid gap-3 border-border-weak border-y py-4 lg:hidden">
							<PostRealmContextSelector
								onValueChange={changeRealm}
								realms={realms}
								value={selectedRealm.id}
							/>
							<PostRealmContextLink realm={selectedRealm} />
						</div>
					) : null}
					<ReplyPostThread
						canReply={post.capabilities.canReply}
						parentPostId={post.postKind === "reply" ? post.id : undefined}
						realmId={realmId}
						rootPostId={post.rootPostId ?? post.id}
					/>
					<RelatedPostRecommendations postId={post.id} />
				</div>
				{selectedRealm ? (
					<aside className="sticky top-20 hidden min-w-0 flex-col gap-3 lg:flex">
						<PostRealmContextSelector
							onValueChange={changeRealm}
							realms={realms}
							value={selectedRealm.id}
						/>
						<PostRealmMainDock realm={selectedRealm} />
					</aside>
				) : null}
			</div>
		</main>
	);
}
