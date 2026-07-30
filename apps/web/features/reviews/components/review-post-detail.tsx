"use client";

import {
	type GetApiPostsByPostIdStatus200,
	getApiReviewsQueryKey,
	useDeleteApiReviewsByReviewId,
} from "@rezics/openapi-tanstack-query";
import { useQueryClient } from "@tanstack/react-query";
import { PencilIcon, Trash2Icon } from "lucide-react";
import { AppLink as Link } from "@/features/application-shell/components/app-link";
import { useApplicationRouter } from "@/features/application-shell/hooks/use-application-router";
import { useState } from "react";

import {
	AlertDialog,
	AlertDialogBody,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	Button,
	Card,
	CardContent,
	CardHeader,
	CardTitle,
	MenuItem,
} from "@rezics/ui";
import { FeedOverflowMenu } from "@/features/content-feed/components/feed-card-actions";
import { PostDetailArticle } from "@/features/posts/components/post-detail-article";
import { resolvePostPresentationTitle } from "@/features/posts/model/post-presentation-title";
import { ProgressEventDescription } from "@/features/progress/components/progress-event-description";
import { getPostManagementSectionIds } from "@/features/posts/model/post-management-section";
import { invalidatePostQueries } from "@/features/posts/query";
import { postManagementSectionHref } from "@/features/posts/routing/post-management-routes";
import { isCatalogDetailUnitType } from "@/features/units/model/catalog-detail-section";
import { useTranslation } from "@/i18n/client";
import { RequestFailure } from "@/i18n/request-failure";
import { ReviewAttachedScores } from "./review-attached-scores";

type ReviewPost = Extract<GetApiPostsByPostIdStatus200, { postKind: "review" }>;

export function ReviewPostDetail({ review }: { readonly review: ReviewPost }) {
	const remove = useDeleteApiReviewsByReviewId();
	const queryClient = useQueryClient();
	const router = useApplicationRouter();
	const { t } = useTranslation(["engagement", "posts", "ui"]);
	const [deleteOpen, setDeleteOpen] = useState(false);
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
	const deleteReview = async () => {
		try {
			await remove.mutateAsync({ path: { reviewId: review.id } });
			await Promise.all([
				queryClient.invalidateQueries({ queryKey: getApiReviewsQueryKey() }),
				invalidatePostQueries(queryClient, review.id),
			]);
			setDeleteOpen(false);
			router.push("/reviews");
		} catch {
			// The typed mutation state supplies the visible API error.
		}
	};

	return (
		<>
			{review.progressEntry &&
			review.subject &&
			isCatalogDetailUnitType(review.subject.type) ? (
				<Card appearance="outlined" className="mb-5">
					<CardHeader>
						<CardTitle>{t.engagement.progressJournal.linkedReview}</CardTitle>
					</CardHeader>
					<CardContent>
						<p className="text-sm">
							<ProgressEventDescription
								entry={review.progressEntry}
								type={review.subject.type}
							/>
						</p>
					</CardContent>
				</Card>
			) : null}
			<PostDetailArticle
				commentsHref="#replies"
				engagementOverflow={
					<>
						<FeedOverflowMenu
							canExclude={false}
							itemId={review.id}
							reportTarget={{
								unitId: review.id,
								realmId: review.realmId ?? undefined,
							}}
						>
							{editHref ? (
								<MenuItem asChild value="edit-review">
									<Link href={editHref}>
										<PencilIcon aria-hidden />
										{t.ui.edit}
									</Link>
								</MenuItem>
							) : null}
							{review.capabilities.canEdit ? (
								<MenuItem
									onSelect={() => setDeleteOpen(true)}
									value="delete-review"
									variant="destructive"
								>
									<Trash2Icon aria-hidden />
									{t.engagement.deleteReview}
								</MenuItem>
							) : null}
						</FeedOverflowMenu>
						{review.capabilities.canEdit ? (
							<AlertDialog
								onOpenChange={({ open }) => setDeleteOpen(open)}
								open={deleteOpen}
							>
								<AlertDialogContent>
									<AlertDialogHeader>
										<AlertDialogTitle>
											{t.engagement.deleteReview}
										</AlertDialogTitle>
									</AlertDialogHeader>
									<AlertDialogBody>
										<AlertDialogDescription>
											{t.engagement.deleteReviewPrompt}
										</AlertDialogDescription>
									</AlertDialogBody>
									<AlertDialogFooter>
										<AlertDialogCancel>{t.engagement.cancel}</AlertDialogCancel>
										<Button
											isLoading={remove.isPending}
											onClick={() => void deleteReview()}
											type="button"
											variant="destructive"
										>
											{t.engagement.delete}
										</Button>
									</AlertDialogFooter>
								</AlertDialogContent>
							</AlertDialog>
						) : null}
					</>
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
			<RequestFailure error={remove.error} fallback={t.ui.retryLater} />
		</>
	);
}
