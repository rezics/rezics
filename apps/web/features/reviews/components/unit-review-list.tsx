"use client";

import type { ContentLanguage } from "@rezics/i18n";
import {
	type GetApiReviewsSort,
	type GetApiReviewsStatus200,
	useGetApiReviews,
} from "@rezics/openapi-tanstack-query";

import { FeedItemCard } from "@/features/content-feed/components/feed-item-card";
import { FeedList, type FeedListState } from "@/features/content-feed/components/feed-list";
import { useTranslation } from "@/i18n/client";
import type { UnitScore } from "../model/score-value";

interface UnitReviewListBaseProps {
	readonly languages?: readonly ContentLanguage[];
	readonly limit?: number;
	readonly realmIds?: readonly string[];
	readonly sort?: GetApiReviewsSort;
	readonly targetId: string;
}

export type UnitReviewListProps = UnitReviewListBaseProps &
	(
		| Readonly<{ scores?: undefined; scoreContextUnitId?: undefined }>
		| Readonly<{ scores: readonly UnitScore[]; scoreContextUnitId: string }>
	);

export function UnitReviewList({
	languages,
	limit = 50,
	realmIds,
	scores,
	scoreContextUnitId,
	sort = "best",
	targetId,
}: UnitReviewListProps) {
	const query = useGetApiReviews({
		query: {
			targetId,
			...(realmIds?.length ? { realmIds: [...realmIds] } : {}),
			...(languages?.length ? { languages: [...languages] } : {}),
			...(scores?.length && scoreContextUnitId
				? { scoreContextUnitId, scores: [...scores] }
				: {}),
			sort,
			limit,
		},
	});
	const state: FeedListState<ReviewListItem> = query.isPending
		? { status: "pending" }
		: query.isError
			? { status: "error", retry: () => void query.refetch() }
			: { status: "ready", items: query.data?.items ?? [] };
	return <ReviewFeedList state={state} />;
}

type ReviewListItem = GetApiReviewsStatus200["items"][number];

export function ReviewCards({ items }: { readonly items: readonly ReviewListItem[] }) {
	return <ReviewFeedList state={{ status: "ready", items }} />;
}

function ReviewFeedList({ state }: { readonly state: FeedListState<ReviewListItem> }) {
	const { t } = useTranslation(["actions", "engagement", "feed", "state"]);
	return (
		<FeedList
			aria-label={t.engagement.reviews}
			emptyBody={t.engagement.emptyReviews}
			emptyTitle={t.engagement.emptyReviews}
			errorLabel={t.state.error}
			getItemKey={(review) => review.id}
			renderItem={(review, metadata) => (
				<FeedItemCard
					item={review}
					position={metadata.position}
					setSize={metadata.setSize}
				/>
			)}
			retryLabel={t.actions.retry}
			state={state}
		/>
	);
}
