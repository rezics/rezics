"use client";

import { type GetApiPostsByPostIdStatus200 } from "@rezics/openapi-tanstack-query";
import { Card, CardContent, CardHeader, CardTitle } from "@rezics/ui";
import { PostDetailArticle } from "@/features/posts/components/post-detail-article";
import { PostOverflowMenu } from "@/features/posts/components/post-overflow-menu";
import { resolvePostPresentationTitle } from "@/features/posts/model/post-presentation-title";
import { ProgressEventDescription } from "@/features/progress/components/progress-event-description";
import { isProgressTrackableUnitType } from "@/features/progress/model/progress-record";
import { getPostManagementSectionIds } from "@/features/posts/model/post-management-section";
import { postManagementSectionHref } from "@/features/posts/routing/post-management-routes";
import { useTranslation } from "@/i18n/client";
import { ReviewAttachedScores } from "./review-attached-scores";

type ReviewPost = Extract<GetApiPostsByPostIdStatus200, { postKind: "review" }>;

export function ReviewPostDetail({ review }: { readonly review: ReviewPost }) {
	const { t } = useTranslation(["engagement", "posts", "ui"]);
	const title = resolvePostPresentationTitle(review, {
		postBy: t.posts.postFallbackTitle,
		reviewOf: t.posts.reviewFallbackTitle,
		reply: t.posts.replyPost,
		unknownAttribution: t.posts.unknownAttribution,
		unnamedSubject: t.ui.unnamed,
		untitled: t.posts.untitled,
	});
	const managementSectionId = getPostManagementSectionIds(review)[0];
	const editHref = managementSectionId
		? postManagementSectionHref(review.id, managementSectionId)
		: undefined;
	return (
		<>
			{review.progressEntry &&
			review.subject &&
			isProgressTrackableUnitType(review.subject.type) ? (
				<Card appearance="outlined" className="mb-5">
					<CardHeader>
						<CardTitle>{t.engagement.progressJournal.linkedReview}</CardTitle>
					</CardHeader>
					<CardContent>
						<p className="text-sm">
							<ProgressEventDescription entry={review.progressEntry} type={review.subject.type} />
						</p>
					</CardContent>
				</Card>
			) : null}
			<PostDetailArticle
				commentsHref="#replies"
				engagementOverflow={
					<PostOverflowMenu
						availableLanguages={review.availableLanguages}
						currentLanguage={review.language}
						editAction={editHref ? { kind: "link", href: editHref } : undefined}
						postId={review.id}
						realmId={review.realmId ?? undefined}
					/>
				}
				post={{
					id: review.id,
					postKind: review.postKind,
					attributions: review.attributions,
					realmId: review.realmId,
					language: review.language,
					title: title.value,
					titleLanguage: title.language ?? null,
					summary: review.summary,
					body: review.body,
					createdAt: review.createdAt,
				}}
				replyCount={Number(review.replyCount)}
				variant="thread"
			/>
			<ReviewAttachedScores reviewId={review.id} scores={review.scores} />
		</>
	);
}
