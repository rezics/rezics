"use client";

import {
	getApiReviewsByReviewIdQueryKey,
	getApiReviewsQueryKey,
	useDeleteApiReviewsByReviewId,
	useGetApiReviewsByReviewId,
} from "@rezics/openapi-tanstack-query";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";

import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogBody,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
	Button,
	QueryFailure,
	QueryPending,
} from "@rezics/ui";
import { PostDetailArticle } from "@/features/posts/components/post-detail-article";
import { PostSubjectHero } from "@/features/posts/components/post-subject-hero";
import { RelatedPostRecommendations } from "@/features/posts/post-list";
import { useTranslation } from "@/i18n/client";
import { RequestFailure } from "@/i18n/request-failure";

export function ReviewDetailPage({
	id,
	realmId,
}: {
	readonly id: string;
	readonly realmId?: string;
}) {
	const query = useGetApiReviewsByReviewId({
		path: { reviewId: id },
		query: { ...(realmId ? { realmId } : {}) },
	});
	const remove = useDeleteApiReviewsByReviewId();
	const queryClient = useQueryClient();
	const router = useRouter();
	const { t } = useTranslation(["engagement", "ui"]);
	if (query.isPending) return <QueryPending />;
	if (query.isError)
		return <QueryFailure error={query.error} retry={() => void query.refetch()} />;
	if (!query.data) return null;
	const review = query.data;
	const deleteReview = async () => {
		try {
			await remove.mutateAsync({ path: { reviewId: id } });
			await Promise.all([
				queryClient.invalidateQueries({ queryKey: getApiReviewsQueryKey() }),
				queryClient.invalidateQueries({
					queryKey: getApiReviewsByReviewIdQueryKey({ path: { reviewId: id } }),
				}),
			]);
			router.push("/reviews");
		} catch {
			// The typed mutation state supplies the visible API error.
		}
	};
	return (
		<main className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-10">
			{review.subject ? <PostSubjectHero subject={review.subject} /> : null}
			<PostDetailArticle
				actions={
					review.capabilities.canEdit ? (
						<>
							<Button asChild size="sm" variant="outline">
								<Link href={`/reviews/${id}/edit`}>{t.ui.edit}</Link>
							</Button>
							<AlertDialog>
								<AlertDialogTrigger asChild>
									<Button size="sm" variant="destructive">
										{t.engagement.deleteReview}
									</Button>
								</AlertDialogTrigger>
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
										<AlertDialogAction
											isLoading={remove.isPending}
											onClick={() => void deleteReview()}
											variant="destructive"
										>
											{t.engagement.delete}
										</AlertDialogAction>
									</AlertDialogFooter>
								</AlertDialogContent>
							</AlertDialog>
						</>
					) : undefined
				}
				post={{
					id: review.id,
					postKind: review.postKind,
					attributions: review.attributions,
					realmId: review.realmId,
					title: review.title ?? t.ui.unnamed,
					summary: review.summary,
					body: review.body,
					createdAt: review.createdAt,
					scores: review.scores,
				}}
			/>
			<RelatedPostRecommendations postId={review.id} />
			<RequestFailure error={remove.error} fallback={t.ui.retryLater} />
		</main>
	);
}
