"use client";

import { useGetApiReviews } from "@rezics/openapi-tanstack-query";
import { Button, Field, FieldLabel, QueryFailure } from "@rezics/ui";
import { combineUnitPredicates } from "@rezics/filter";
import { ChevronRight } from "lucide-react";
import { useQueryStates } from "nuqs";
import { useMemo } from "react";

import { AppLink as Link } from "@/features/application-shell/components/app-link";
import {
	ApiFeedList,
	type ApiFeedResultMetadata,
} from "@/features/content-feed/data/api-feed-list";
import { createSubjectFeedPredicate } from "@/features/content-feed/model/subject-feed-filter";
import { RealmScoreContextLink } from "@/features/realms/components/realm-score-context-link";
import { useTranslation } from "@/i18n/client";
import { useLocalizationLanguages } from "@/i18n/use-localization-languages";
import { toNonNegativeApiInteger } from "@/lib/api-number";
import { useDefaultScoreRealm } from "../data/default-score-realm";
import { createReviewScorePredicate } from "../model/unit-review-feed-filter";
import type { UnitScore } from "../model/score-value";
import { reviewFeedHref, reviewFeedSearchParams } from "../routing/review-feed-search-params";
import { CommunityScoreOverview } from "./community-score-overview";
import { ScoreRealmPicker } from "./score-realm-picker";

const ReviewPreviewPageSize = 5;
const ReviewPageSize = 20;

export function UnitReviewFeed({
	mode,
	moreReviewsHref,
	targetId,
}: {
	readonly mode: "page" | "preview";
	readonly moreReviewsHref?: string;
	readonly targetId: string;
}) {
	const { locale, t } = useTranslation(["engagement"]);
	const localizationLanguages = useLocalizationLanguages();
	const defaultScoreRealm = useDefaultScoreRealm();
	const [route, setRoute] = useQueryStates(reviewFeedSearchParams);
	const scoreRealm = route.scoreRealm ?? defaultScoreRealm.realm;
	const pageSize = mode === "preview" ? ReviewPreviewPageSize : ReviewPageSize;
	const additionalFilter = useMemo(
		() =>
			combineUnitPredicates([
				createSubjectFeedPredicate({ kind: "review", subjectId: targetId }),
				createReviewScorePredicate({
					realmId: scoreRealm?.id,
					scores: route.scores,
				}),
			]),
		[route.scores, scoreRealm?.id, targetId],
	);
	const reviewCountQuery = useGetApiReviews({
		query: {
			targetId,
			localizationLanguages,
			limit: 1,
			sort: "best",
		},
	});
	const scoreRealmOptions = [
		...new Map(
			[defaultScoreRealm.realm, scoreRealm]
				.filter((option) => option !== undefined)
				.map((option) => [option.id, option]),
		).values(),
	];
	const toggleScore = (score: UnitScore) => {
		const scores = route.scores.includes(score)
			? route.scores.filter((candidate) => candidate !== score)
			: [...route.scores, score].sort((left, right) => left - right);
		void setRoute({ scores });
	};
	const moreHref =
		mode === "preview" && moreReviewsHref
			? reviewFeedHref(moreReviewsHref, {
					languages: route.languages,
					q: route.q,
					realms: route.realms,
					scoreRealm: scoreRealm ?? null,
					scores: route.scores,
					sort: route.sort,
					tags: route.tags,
				})
			: undefined;
	const formatRange = ({ displayedCount, total }: ApiFeedResultMetadata) => {
		const numberFormat = new Intl.NumberFormat(locale.current);
		const values = {
			end: numberFormat.format(displayedCount),
			start: numberFormat.format(displayedCount ? 1 : 0),
			total: numberFormat.format(total.value),
		};
		return (
			<p className="text-sm text-muted-foreground" role="status">
				{total.relation === "exact"
					? t.engagement.reviewResultRange(values)
					: t.engagement.reviewResultRangeLowerBound(values)}
			</p>
		);
	};

	return (
		<div className="mx-auto grid w-full max-w-5xl gap-6">
			<div className="grid gap-5">
				<Field className="w-full max-w-sm">
					<FieldLabel>{t.engagement.scoreRealm}</FieldLabel>
					<ScoreRealmPicker
						onChange={(selection) => void setRoute({ scoreRealm: selection })}
						options={scoreRealmOptions}
						value={scoreRealm}
					/>
					{scoreRealm ? (
						<RealmScoreContextLink realmId={scoreRealm.id} showUnavailable />
					) : null}
				</Field>
				<CommunityScoreOverview
					realmId={scoreRealm?.id}
					onScoreFilterToggle={toggleScore}
					reviewCount={toNonNegativeApiInteger(reviewCountQuery.data?.totalCount)}
					selectedScores={route.scores}
					targetId={targetId}
				/>
				{reviewCountQuery.isError ? (
					<QueryFailure
						error={reviewCountQuery.error}
						retry={() => void reviewCountQuery.refetch()}
					/>
				) : null}
			</div>

			<ApiFeedList
				additionalFilter={additionalFilter}
				aria-label={t.engagement.reviews}
				contentKinds={["post:review"]}
				displayContext={{ kind: "unit", unitId: targetId }}
				emptyBody={t.engagement.emptyFilteredReviews}
				emptyTitle={t.engagement.emptyReviews}
				languages={route.languages}
				limit={pageSize}
				onLanguagesChange={(languages) => void setRoute({ languages: [...languages] })}
				onRealmIdsChange={(realms) => void setRoute({ realms: [...realms] })}
				onSortChange={(sort) => void setRoute({ sort })}
				onTagIdsChange={(tags) => void setRoute({ tags: [...tags] })}
				pagination={mode === "page" ? "infinite" : "none"}
				realmIds={route.realms}
				renderSummary={formatRange}
				search={{
					label: t.engagement.searchReviews,
					onQueryChange: (q) => void setRoute({ q }),
					placeholder: t.engagement.searchReviewsPlaceholder,
					query: route.q,
				}}
				sort={route.sort}
				tagIds={route.tags}
			/>

			{moreHref ? (
				<div className="flex items-center gap-5 py-2">
					<span aria-hidden className="h-px flex-1 bg-border-weak" />
					<Button asChild className="shrink-0" variant="quiet">
						<Link href={moreHref}>
							{t.engagement.moreReviewsAndRatings}
							<ChevronRight aria-hidden />
						</Link>
					</Button>
					<span aria-hidden className="h-px flex-1 bg-border-weak" />
				</div>
			) : null}
		</div>
	);
}
