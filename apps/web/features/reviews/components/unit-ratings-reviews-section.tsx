"use client";

import { ContentLanguageValues, type ContentLanguage } from "@rezics/i18n";
import { useGetApiReviews } from "@rezics/openapi-tanstack-query";
import {
	Button,
	ChoiceSelect,
	Field,
	FieldLabel,
	Input,
	Popover,
	PopoverBody,
	PopoverContent,
	PopoverHeader,
	PopoverTrigger,
	QueryFailure,
	QueryPending,
} from "@rezics/ui";
import { BookOpen, ChevronRight, Search, SlidersHorizontal } from "lucide-react";
import Link from "next/link";
import { useDeferredValue, useState } from "react";

import type { CatalogDetailUnitType } from "@/features/units/model/catalog-detail-section";
import { useTranslation } from "@/i18n/client";
import { toNonNegativeApiInteger } from "@/lib/api-number";
import { useDefaultScoreRealm } from "../data/default-score-realm";
import { apiValueToUnitScore, type UnitScore } from "../model/score-value";
import { CommunityScoreOverview } from "./community-score-overview";
import { ReviewCards } from "./unit-review-list";
import { UnitScoreControl } from "./unit-score-control";

const ScoreFilterValues = ["10", "9", "8", "7", "6", "5", "4", "3", "2", "1"] as const;
type ScoreFilterValue = (typeof ScoreFilterValues)[number];

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
	const { t } = useTranslation(["engagement", "search"]);
	const defaultScoreRealm = useDefaultScoreRealm();
	const [search, setSearch] = useState("");
	const deferredSearch = useDeferredValue(search);
	const [languages, setLanguages] = useState<readonly ContentLanguage[]>([]);
	const [scores, setScores] = useState<readonly ScoreFilterValue[]>([]);
	const language = languages[0];
	const score = selectedScore(scores[0]);
	const trimmedSearch = deferredSearch.trim();
	const baseReviewQuery = { targetId, limit: 3 } as const;
	const summaryQuery = useGetApiReviews({ query: baseReviewQuery });
	const reviewsQuery = useGetApiReviews({
		query: {
			...baseReviewQuery,
			...(language ? { language } : {}),
			...(trimmedSearch ? { search: trimmedSearch } : {}),
			...(score ? { score } : {}),
			...(score && defaultScoreRealm.realm
				? { scoreRealmId: defaultScoreRealm.realm.id }
				: {}),
		},
	});
	const hasFilters = Boolean(search || language || score);

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
					realmId={defaultScoreRealm.realm?.id}
					reviewCount={toNonNegativeApiInteger(summaryQuery.data?.totalCount)}
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
						className="h-11 rounded-full ps-11"
						onChange={(event) => setSearch(event.currentTarget.value)}
						placeholder={t.engagement.searchReviews}
						type="search"
						value={search}
					/>
				</label>
				<Popover positioning={{ placement: "bottom-end" }}>
					<PopoverTrigger asChild>
						<Button className="rounded-full px-5" variant="outline">
							<SlidersHorizontal aria-hidden />
							{t.engagement.reviewFilters}
							{hasFilters ? (
								<span className="rounded-full bg-foreground px-1.5 text-xs text-background">
									{Number(Boolean(language)) +
										Number(Boolean(score)) +
										Number(Boolean(search))}
								</span>
							) : null}
						</Button>
					</PopoverTrigger>
					<PopoverContent className="w-[min(22rem,calc(100vw-2rem))]">
						<PopoverHeader title={t.engagement.reviewFilters} />
						<PopoverBody className="grid gap-5">
							<Field>
								<FieldLabel>{t.engagement.reviewLanguage}</FieldLabel>
								<ChoiceSelect
									appearance="field"
									ariaLabel={t.engagement.reviewLanguage}
									onValueChange={setLanguages}
									options={ContentLanguageValues.map((value) => ({
										label: t.search.languageOptions[value],
										value,
									}))}
									placeholder={t.engagement.allReviewLanguages}
									value={languages}
								/>
							</Field>
							<Field>
								<FieldLabel>{t.engagement.reviewScoreFilter}</FieldLabel>
								<ChoiceSelect
									appearance="field"
									ariaLabel={t.engagement.reviewScoreFilter}
									onValueChange={setScores}
									options={ScoreFilterValues.map((value) => ({
										label: t.engagement.reviewScoreOption({
											score: Number(value),
										}),
										value,
									}))}
									placeholder={t.engagement.allReviewScores}
									value={scores}
								/>
							</Field>
							{hasFilters ? (
								<Button
									className="w-fit"
									onClick={() => {
										setSearch("");
										setLanguages([]);
										setScores([]);
									}}
									variant="quiet"
								>
									{t.engagement.clearReviewFilters}
								</Button>
							) : null}
						</PopoverBody>
					</PopoverContent>
				</Popover>
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
		</section>
	);
}

function selectedScore(value: ScoreFilterValue | undefined): UnitScore | undefined {
	return value ? apiValueToUnitScore(Number(value)) : undefined;
}
