"use client";

import { useGetApiScoresByTargetId } from "@rezics/openapi-tanstack-query";
import { cn, Rating } from "@rezics/ui";

import { useTranslation } from "@/i18n/client";
import { RequestFailure } from "@/i18n/request-failure";
import { toFiniteApiNumber, toNonNegativeApiInteger } from "@/lib/api-number";
import { RealmScoreContextLink } from "@/features/realms/components/realm-score-context-link";
import { UnitScoreValues, type UnitScore } from "../model/score-value";

export function CommunityScoreOverview({
	realmId,
	onScoreFilterToggle,
	reviewCount,
	selectedScores,
	targetId,
}: {
	readonly onScoreFilterToggle: (score: UnitScore) => void;
	readonly realmId?: string;
	readonly reviewCount: number;
	readonly selectedScores: readonly UnitScore[];
	readonly targetId: string;
}) {
	return realmId ? (
		<LoadedCommunityScoreOverview
			realmId={realmId}
			onScoreFilterToggle={onScoreFilterToggle}
			reviewCount={reviewCount}
			selectedScores={selectedScores}
			targetId={targetId}
		/>
	) : (
		<CommunityScoreOverviewContent
			average={0}
			counts={EmptyDistribution}
			ratingCount={0}
			reviewCount={reviewCount}
			selectedScores={selectedScores}
		/>
	);
}

const EmptyDistribution: Readonly<Record<UnitScore, number>> = {
	1: 0,
	2: 0,
	3: 0,
	4: 0,
	5: 0,
	6: 0,
	7: 0,
	8: 0,
	9: 0,
	10: 0,
};

function LoadedCommunityScoreOverview({
	realmId,
	onScoreFilterToggle,
	reviewCount,
	selectedScores,
	targetId,
}: {
	readonly onScoreFilterToggle: (score: UnitScore) => void;
	readonly realmId: string;
	readonly reviewCount: number;
	readonly selectedScores: readonly UnitScore[];
	readonly targetId: string;
}) {
	const query = useGetApiScoresByTargetId({
		path: { targetId },
		query: { realmId },
	});
	const { t } = useTranslation(["ui"]);
	const ratingCount = toNonNegativeApiInteger(query.data?.totalCount);
	const average = ratingCount
		? (toFiniteApiNumber(query.data?.totalScore) ?? 0) / ratingCount
		: 0;
	const countFor = (score: UnitScore) =>
		toNonNegativeApiInteger(query.data?.distribution[String(score)]);
	const counts: Readonly<Record<UnitScore, number>> = {
		1: countFor(1),
		2: countFor(2),
		3: countFor(3),
		4: countFor(4),
		5: countFor(5),
		6: countFor(6),
		7: countFor(7),
		8: countFor(8),
		9: countFor(9),
		10: countFor(10),
	};

	return (
		<>
			<CommunityScoreOverviewContent
				average={average}
				counts={counts}
				onScoreFilterToggle={onScoreFilterToggle}
				ratingCount={ratingCount}
				reviewCount={reviewCount}
				selectedScores={selectedScores}
			/>
			<RealmScoreContextLink realmId={realmId} />
			<RequestFailure error={query.error} fallback={t.ui.retryLater} />
		</>
	);
}

function CommunityScoreOverviewContent({
	average,
	counts,
	onScoreFilterToggle,
	ratingCount,
	reviewCount,
	selectedScores,
}: {
	readonly average: number;
	readonly counts: Readonly<Record<UnitScore, number>>;
	readonly onScoreFilterToggle?: (score: UnitScore) => void;
	readonly ratingCount: number;
	readonly reviewCount: number;
	readonly selectedScores: readonly UnitScore[];
}) {
	const { locale, t } = useTranslation(["engagement"]);
	const numberFormat = new Intl.NumberFormat(locale.current);
	const maximumCount = UnitScoreValues.reduce(
		(maximum, score) => Math.max(maximum, counts[score]),
		0,
	);

	return (
		<div className="grid gap-6">
			<div className="flex flex-wrap items-center gap-x-4 gap-y-2">
				<Rating
					allowHalf
					aria-hidden
					className="pointer-events-none text-muted-foreground **:data-[highlighted]:text-warning **:data-[slot=rating-item-indicator]:size-7"
					count={5}
					readOnly
					value={average / 2}
				/>
				<strong className="font-heading text-3xl tabular-nums">{average.toFixed(1)}</strong>
				<span className="text-sm text-muted-foreground">
					{t.engagement.reviewCounts({
						ratings: numberFormat.format(ratingCount),
						reviews: numberFormat.format(reviewCount),
					})}
				</span>
			</div>

			<div className="mx-auto grid w-full max-w-[44rem] grid-cols-10 gap-1 sm:gap-2">
				{UnitScoreValues.map((score) => {
					const count = counts[score];
					const percent = ratingCount ? Math.round((count / ratingCount) * 100) : 0;
					const heightPercent = maximumCount
						? Math.round((count / maximumCount) * 100)
						: 0;
					const isSelected = selectedScores.includes(score);
					const scoreLabel = t.engagement.scoreDistributionLabel({ score });
					const distributionLabel = t.engagement.scoreDistribution({
						count: numberFormat.format(count),
						percent: numberFormat.format(percent),
					});
					return (
						<button
							aria-label={`${scoreLabel} ${distributionLabel}`}
							aria-pressed={isSelected}
							className="relative isolate grid min-w-0 grid-rows-[7rem_auto_auto] gap-1 rounded-md px-0.5 pb-1 text-center text-xs before:pointer-events-none before:absolute before:inset-x-0 before:-inset-y-2 before:-z-10 before:rounded-md before:bg-surface-hover before:opacity-0 before:shadow-sm/5 before:transition-opacity before:duration-200 before:content-[''] hover:before:opacity-100 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:before:opacity-100 aria-pressed:before:bg-surface-selected aria-pressed:before:opacity-100 motion-reduce:before:transition-none sm:px-1"
							disabled={!onScoreFilterToggle}
							key={score}
							onClick={() => onScoreFilterToggle?.(score)}
							type="button"
						>
							<span className="flex h-28 items-end border-b border-border px-0.5 sm:px-1">
								<span
									aria-hidden
									className={cn(
										"block w-full rounded-t-sm bg-warning transition-[height,opacity]",
										!isSelected && selectedScores.length > 0 && "opacity-45",
									)}
									style={{
										height: count ? `${Math.max(heightPercent, 2)}%` : "0%",
									}}
								/>
							</span>
							<span className="font-semibold tabular-nums">{score}</span>
							<span className="min-w-0 text-[0.625rem] leading-4 tabular-nums text-muted-foreground sm:whitespace-nowrap">
								{distributionLabel}
							</span>
						</button>
					);
				})}
			</div>
		</div>
	);
}
