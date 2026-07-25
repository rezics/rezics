"use client";

import { useGetApiReviews } from "@rezics/openapi-tanstack-query";
import { Button, Input, QueryFailure, QueryPending } from "@rezics/ui";
import { BookOpen, ChevronRight, Search, SlidersHorizontal } from "lucide-react";
import Link from "next/link";
import { useDeferredValue, useState } from "react";

import type { CatalogDetailUnitType } from "@/features/units/model/catalog-detail-section";
import { useTranslation } from "@/i18n/client";
import { toNonNegativeApiInteger } from "@/lib/api-number";
import { useDefaultScoreRealm } from "../data/default-score-realm";
import {
	EmptyReviewFilters,
	hasReviewFilters,
	reviewFilterCount,
	toggleReviewScore,
	type ReviewFilterModel,
} from "../model/review-filter-model";
import { CommunityScoreOverview } from "./community-score-overview";
import { ReviewFiltersDialog } from "./review-filters-dialog";
import { ReviewCards } from "./unit-review-list";
import { UnitScoreControl } from "./unit-score-control";

export function UnitRatingsReviewsSection({
	moreReviewsHref,
	targetId,
	type,
	writeReviewHref,
}: {
	readonly moreReviewsHref: string;
	readonly targetId: string;
	readonly type: CatalogDetailUnitType;
	readonly writeReviewHref: string;
}) {
	const { t } = useTranslation(["engagement"]);
	const defaultScoreRealm = useDefaultScoreRealm();
	const [search, setSearch] = useState("");
	const deferredSearch = useDeferredValue(search);
	const [filters, setFilters] = useState<ReviewFilterModel>(EmptyReviewFilters);
	const [filterDialogOpen, setFilterDialogOpen] = useState(false);
	const scoreRealm = filters.realm ?? defaultScoreRealm.realm;
	const trimmedSearch = deferredSearch.trim();
	const baseReviewQuery = { targetId, limit: 3 } as const;
	const summaryQuery = useGetApiReviews({ query: baseReviewQuery });
	const reviewsQuery = useGetApiReviews({
		query: {
			...baseReviewQuery,
			...(filters.realm ? { realmId: filters.realm.id } : {}),
			...(filters.languages.length ? { languages: [...filters.languages] } : {}),
			...(trimmedSearch ? { search: trimmedSearch } : {}),
			...(filters.scores.length && scoreRealm
				? {
						scoreRealmId: scoreRealm.id,
						scores: [...filters.scores],
					}
				: {}),
		},
	});
	const appliedFilterCount = reviewFilterCount(filters);
	const hasFilters = Boolean(search.trim()) || hasReviewFilters(filters);

	return (
		<section className="grid gap-8 border-t border-border-weak pt-8">
			<h2 className="font-heading text-2xl font-bold sm:text-3xl">
				{t.engagement.ratingsAndReviews}
			</h2>

			<div className="grid justify-items-center gap-4 py-3 text-center sm:py-6">
				<span className="grid size-14 place-items-center rounded-full bg-surface-muted text-muted-foreground">
					<BookOpen aria-hidden className="size-7" />
				</span>
				<h3 className="font-heading text-2xl font-bold sm:text-3xl">
					{t.engagement.whatDoYouThink}
				</h3>
				<div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
					<UnitScoreControl targetId={targetId} type={type} />
					<Button asChild className="mt-1 rounded-full px-6" variant="solid">
						<Link href={writeReviewHref}>{t.engagement.newReview}</Link>
					</Button>
				</div>
			</div>

			<div className="grid gap-6 border-t border-border-weak pt-7">
				<h3 className="font-heading text-xl font-bold sm:text-2xl">
					{t.engagement.communityReviews}
				</h3>
				<CommunityScoreOverview
					onScoreFilterToggle={(score) =>
						setFilters((current) => toggleReviewScore(current, score))
					}
					realmId={scoreRealm?.id}
					reviewCount={toNonNegativeApiInteger(summaryQuery.data?.totalCount)}
					selectedScores={filters.scores}
					targetId={targetId}
				/>
				{summaryQuery.isError ? (
					<QueryFailure
						error={summaryQuery.error}
						retry={() => void summaryQuery.refetch()}
					/>
				) : null}
			</div>

			<div className="flex flex-col gap-3 sm:flex-row">
				<label className="relative min-w-0 flex-1">
					<span className="sr-only">{t.engagement.searchReviews}</span>
					<Search
						aria-hidden
						className="pointer-events-none absolute start-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
					/>
					<Input
						className="h-11 ps-11"
						onChange={(event) => setSearch(event.currentTarget.value)}
						placeholder={t.engagement.searchReviews}
						type="search"
						value={search}
					/>
				</label>
				<Button
					className="h-11 px-4"
					onClick={() => setFilterDialogOpen(true)}
					type="button"
					variant="outline"
				>
					<SlidersHorizontal aria-hidden />
					{t.engagement.reviewFilters}
					{appliedFilterCount ? (
						<span className="min-w-5 rounded-sm bg-foreground px-1 text-xs text-background">
							{appliedFilterCount}
						</span>
					) : null}
				</Button>
			</div>

			<div aria-live="polite">
				{reviewsQuery.isPending ? (
					<QueryPending />
				) : reviewsQuery.isError ? (
					<QueryFailure
						error={reviewsQuery.error}
						retry={() => void reviewsQuery.refetch()}
					/>
				) : reviewsQuery.data.items.length ? (
					<ReviewCards items={reviewsQuery.data.items} />
				) : (
					<p className="text-sm text-muted-foreground">
						{hasFilters ? t.engagement.emptyFilteredReviews : t.engagement.emptyReviews}
					</p>
				)}
			</div>

			<div className="flex items-center gap-5 py-2">
				<span aria-hidden className="h-px flex-1 bg-border-weak" />
				<Link
					className="flex shrink-0 items-center gap-1 text-sm font-semibold hover:underline"
					href={moreReviewsHref}
				>
					{t.engagement.moreReviewsAndRatings}
					<ChevronRight aria-hidden className="size-4" />
				</Link>
				<span aria-hidden className="h-px flex-1 bg-border-weak" />
			</div>

			{filterDialogOpen ? (
				<ReviewFiltersDialog
					initialFilters={filters}
					onApply={(nextFilters) => {
						setFilters(nextFilters);
						setFilterDialogOpen(false);
					}}
					onClose={() => setFilterDialogOpen(false)}
				/>
			) : null}
		</section>
	);
}
