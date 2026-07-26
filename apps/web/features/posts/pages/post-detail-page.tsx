"use client";

import { useGetApiPostsByPostId } from "@rezics/openapi-tanstack-query";
import Link from "next/link";

import { Button, QueryFailure, QueryPending } from "@rezics/ui";
import { useTranslation } from "@/i18n/client";
import { PostDeleteButton } from "../components/post-delete-button";
import { PostDetailArticle } from "../components/post-detail-article";
import { PostSubjectHero } from "../components/post-subject-hero";
import { RelatedPostRecommendations } from "../post-list";
import { ReplyPostThread } from "../reply-thread";

export function PostDetailPage({ id, realmId }: { id: string; realmId?: string }) {
	const { t } = useTranslation(["posts", "ui"]);
	const query = useGetApiPostsByPostId({
		path: { postId: id },
		query: { ...(realmId ? { realmId } : {}) },
	});
	if (query.isError)
		return <QueryFailure error={query.error} retry={() => void query.refetch()} />;
	if (!query.data) return <QueryPending />;
	const post = query.data;
	const title = post.postKind === "reply" ? t.posts.replyPost : (post.title ?? t.posts.untitled);
	return (
		<main className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-10">
			{post.subject ? <PostSubjectHero subject={post.subject} /> : null}
			<PostDetailArticle
				actions={
					<>
						<Button asChild size="sm" variant="outline">
							<Link href={`/posts/${post.id}/history`}>{t.posts.history}</Link>
						</Button>
						{post.capabilities.canEdit ? (
							<>
								<Button asChild size="sm" variant="outline">
									<Link href={`/posts/${post.id}/edit`}>{t.ui.edit}</Link>
								</Button>
								<PostDeleteButton postId={post.id} rootPostId={post.rootPostId} />
							</>
						) : null}
					</>
				}
				commentsHref="#replies"
				post={{
					id: post.id,
					postKind: post.postKind,
					attributions: post.attributions,
					realmId: post.realmId,
					title,
					body: post.body,
					createdAt: post.createdAt,
					scores: post.scores,
				}}
				replyCount={Number(post.replyCount)}
			/>
			<ReplyPostThread
				canReply={post.capabilities.canReply}
				parentPostId={post.postKind === "reply" ? post.id : undefined}
				realmId={realmId}
				rootPostId={post.rootPostId ?? post.id}
			/>
			<RelatedPostRecommendations postId={post.id} />
		</main>
	);
}
