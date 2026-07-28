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
import { canOpenPostManagement } from "@/features/posts/model/post-management-section";
import { RelatedPostRecommendations } from "@/features/posts/post-list";
import { useTranslation } from "@/i18n/client";
import { useLocalizationFallbackToast } from "@/i18n/use-localization-fallback-toast";
import { useLocalizationLanguages } from "@/i18n/use-localization-languages";
import { RequestFailure } from "@/i18n/request-failure";

export function ReviewDetailPage({
	id,
	realmId,
}: {
	readonly id: string;
	readonly realmId?: string;
}) {
	const localizationLanguages = useLocalizationLanguages();
	const query = useGetApiReviewsByReviewId({
		path: { reviewId: id },
		query: {
			localizationLanguages,
			...(realmId ? { realmId } : {}),
		},
	});
	useLocalizationFallbackToast({
		actualLanguage: query.data?.language ?? null,
		localizationLanguages,
		unitId: id,
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
	const canManage = canOpenPostManagement({
		kind: "review",
		capabilities: review.capabilities,
	});
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
					canManage ? (
						<>
							<Button asChild size="sm" variant="outline">
								<Link href={`/reviews/${id}/edit`}>{t.ui.edit}</Link>
							</Button>
							{review.capabilities.canEdit ? (
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
											<AlertDialogCancel>
												{t.engagement.cancel}
											</AlertDialogCancel>
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
							) : null}
						</>
					) : undefined
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
			/>
			<RelatedPostRecommendations postId={review.id} />
			<RequestFailure error={remove.error} fallback={t.ui.retryLater} />
		</main>
	);
}
