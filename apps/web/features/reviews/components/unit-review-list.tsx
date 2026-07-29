"use client";

import type { ContentLanguage } from "@rezics/i18n";
import {
	type GetApiReviewsSort,
	type GetApiReviewsStatus200,
	useGetApiReviews,
} from "@rezics/openapi-tanstack-query";

import { FeedItemCard } from "@/features/content-feed/components/feed-item-card";
import { FeedList, type FeedListState } from "@/features/content-feed/components/feed-list";
import {
	type FeedDisplayContext,
	UnscopedFeedDisplayContext,
} from "@/features/content-feed/model/feed-display-context";
import { useTranslation } from "@/i18n/client";
import { useLocalizationLanguages } from "@/i18n/use-localization-languages";
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
		| Readonly<{ scores?: undefined; scoreRealmId?: undefined }>
		| Readonly<{ scores: readonly UnitScore[]; scoreRealmId: string }>
	);

export function UnitReviewList({
	languages,
	limit = 50,
	realmIds,
	scores,
	scoreRealmId,
	sort = "best",
	targetId,
}: UnitReviewListProps) {
	const localizationLanguages = useLocalizationLanguages();
	const query = useGetApiReviews({
		query: {
			targetId,
			localizationLanguages,
			...(realmIds?.length ? { realmIds: [...realmIds] } : {}),
			...(languages?.length ? { languages: [...languages] } : {}),
			...(scores?.length && scoreRealmId ? { scoreRealmId, scores: [...scores] } : {}),
			sort,
			limit,
		},
	});
	const state: FeedListState<ReviewListItem> = query.isPending
		? { status: "pending" }
		: query.isError
			? { status: "error", retry: () => void query.refetch() }
			: { status: "ready", items: query.data?.items ?? [] };
	return <ReviewFeedList displayContext={{ kind: "unit", unitId: targetId }} state={state} />;
}

type ReviewListItem = GetApiReviewsStatus200["items"][number];

export function ReviewCards({
	displayContext = UnscopedFeedDisplayContext,
	items,
}: {
	readonly displayContext?: FeedDisplayContext;
	readonly items: readonly ReviewListItem[];
}) {
	return <ReviewFeedList displayContext={displayContext} state={{ status: "ready", items }} />;
}

function ReviewFeedList({
	displayContext,
	state,
}: {
	readonly displayContext: FeedDisplayContext;
	readonly state: FeedListState<ReviewListItem>;
}) {
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
					displayContext={displayContext}
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
