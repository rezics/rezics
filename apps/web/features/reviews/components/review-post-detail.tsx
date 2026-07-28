"use client";

import {
	type GetApiPostsByPostIdStatus200,
	getApiReviewsQueryKey,
	useDeleteApiReviewsByReviewId,
} from "@rezics/openapi-tanstack-query";
import { useQueryClient } from "@tanstack/react-query";
import { PencilIcon, Trash2Icon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
	MenuItem,
} from "@rezics/ui";
import { FeedOverflowMenu } from "@/features/content-feed/components/feed-card-actions";
import { PostDetailArticle } from "@/features/posts/components/post-detail-article";
import { getPostManagementSectionIds } from "@/features/posts/model/post-management-section";
import { invalidatePostQueries } from "@/features/posts/query";
import { postManagementSectionHref } from "@/features/posts/routing/post-management-routes";
import { useTranslation } from "@/i18n/client";
import { RequestFailure } from "@/i18n/request-failure";

type ReviewPost = Extract<GetApiPostsByPostIdStatus200, { postKind: "review" }>;

export function ReviewPostDetail({ review }: { readonly review: ReviewPost }) {
	const remove = useDeleteApiReviewsByReviewId();
	const queryClient = useQueryClient();
	const router = useRouter();
	const { t } = useTranslation(["engagement", "ui"]);
	const [deleteOpen, setDeleteOpen] = useState(false);
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
					title: review.title ?? t.ui.unnamed,
					summary: review.summary,
					body: review.body,
					createdAt: review.createdAt,
					scores: review.scores,
				}}
				replyCount={Number(review.replyCount)}
				variant="thread"
			/>
			<RequestFailure error={remove.error} fallback={t.ui.retryLater} />
		</>
	);
}
