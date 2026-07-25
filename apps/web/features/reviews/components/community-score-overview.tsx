"use client";

import { useGetApiScoresByTargetId } from "@rezics/openapi-tanstack-query";
import { Rating } from "@rezics/ui";

import { useTranslation } from "@/i18n/client";
import { RequestFailure } from "@/i18n/request-failure";
import { toFiniteApiNumber, toNonNegativeApiInteger } from "@/lib/api-number";
import type { UnitScore } from "../model/score-value";

const ScoreDistributionValues = [
	1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
] as const satisfies readonly UnitScore[];

export function CommunityScoreOverview({
	realmId,
	reviewCount,
	targetId,
}: {
	readonly realmId?: string;
	readonly reviewCount: number;
	readonly targetId: string;
}) {
	return realmId ? (
		<LoadedCommunityScoreOverview
			realmId={realmId}
			reviewCount={reviewCount}
			targetId={targetId}
		/>
	) : (
		<CommunityScoreOverviewContent
			average={0}
			counts={EmptyDistribution}
			ratingCount={0}
			reviewCount={reviewCount}
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
	reviewCount,
	targetId,
}: {
	readonly realmId: string;
	readonly reviewCount: number;
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
				ratingCount={ratingCount}
				reviewCount={reviewCount}
			/>
			<RequestFailure error={query.error} fallback={t.ui.retryLater} />
		</>
	);
}

function CommunityScoreOverviewContent({
	average,
	counts,
	ratingCount,
	reviewCount,
}: {
	readonly average: number;
	readonly counts: Readonly<Record<UnitScore, number>>;
	readonly ratingCount: number;
	readonly reviewCount: number;
}) {
	const { locale, t } = useTranslation(["engagement"]);
	const numberFormat = new Intl.NumberFormat(locale.current);
	const maximumCount = ScoreDistributionValues.reduce(
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

			<div className="grid max-w-3xl grid-cols-10 gap-2 sm:gap-3" role="list">
				{ScoreDistributionValues.map((score) => {
					const count = counts[score];
					const percent = ratingCount ? Math.round((count / ratingCount) * 100) : 0;
					const heightPercent = maximumCount
						? Math.round((count / maximumCount) * 100)
						: 0;
					return (
						<div
							className="grid min-w-0 grid-rows-[7rem_auto] gap-2 text-center text-xs"
							key={score}
							role="listitem"
						>
							<span className="flex h-28 items-end border-b border-border px-0.5 sm:px-1">
								<span className="sr-only">
									{t.engagement.scoreDistributionLabel({ score })}{" "}
									{t.engagement.scoreDistribution({
										count: numberFormat.format(count),
										percent: numberFormat.format(percent),
									})}
								</span>
								<span
									aria-hidden
									className="block w-full rounded-t-sm bg-warning"
									style={{
										height: count ? `${Math.max(heightPercent, 2)}%` : "0%",
									}}
								/>
							</span>
							<span
								aria-hidden
								className="font-semibold tabular-nums text-muted-foreground"
							>
								{score}
							</span>
						</div>
					);
				})}
			</div>
		</div>
	);
}
