import { RecommendationPolicy, SortWeightByKind, type RecommendationSort } from "./policy";

export interface RecommendationStats {
	impressions: number;
	opens: number;
	dwell30s: number;
	upvotes: number;
	downvotes: number;
	replies: number;
	favorites: number;
	shares: number;
	highScores: number;
	activeProgress: number;
	completions: number;
	negativeProgress: number;
	engagement6h: number;
	engagement24h: number;
	engagement7d: number;
}

export interface RecommendationCandidate {
	id: string;
	createdAt: Date;
	creditedUnitIds?: readonly string[];
	realmId?: string | null;
	subjectId?: string | null;
	personalizedRelevance: number;
	stats: RecommendationStats;
}

export type RankedRecommendation<T extends RecommendationCandidate> = T & {
	rankScore: number;
};

export const EmptyRecommendationStats: Readonly<RecommendationStats> = {
	impressions: 0,
	opens: 0,
	dwell30s: 0,
	upvotes: 0,
	downvotes: 0,
	replies: 0,
	favorites: 0,
	shares: 0,
	highScores: 0,
	activeProgress: 0,
	completions: 0,
	negativeProgress: 0,
	engagement6h: 0,
	engagement24h: 0,
	engagement7d: 0,
};

function finite(value: number) {
	return Number.isFinite(value) ? value : 0;
}

export function weightedPositive(stats: RecommendationStats) {
	return (
		stats.opens +
		stats.dwell30s * 2 +
		stats.upvotes * 3 +
		stats.replies * 4 +
		stats.favorites * 5 +
		stats.shares * 4 +
		stats.highScores * 5 +
		stats.activeProgress * 3 +
		stats.completions * 5
	);
}

export function weightedNegative(stats: RecommendationStats) {
	return stats.downvotes * 4 + stats.negativeProgress * 4;
}

export function calculateObjective(
	sort: RecommendationSort,
	candidate: RecommendationCandidate,
	asOf: Date,
) {
	const ageHours = Math.max(0, (asOf.getTime() - candidate.createdAt.getTime()) / 3_600_000);
	const positive = weightedPositive(candidate.stats);
	const negative = weightedNegative(candidate.stats);
	const observed = Math.max(candidate.stats.impressions, positive + negative);
	if (sort === "new") return candidate.createdAt.getTime();
	if (sort === "top") return finite(Math.log1p(Math.max(0, positive - negative)));
	if (sort === "hot")
		return finite(
			(candidate.stats.engagement24h + positive * 0.05 + 1) / Math.pow(ageHours + 2, 0.6),
		);
	if (sort === "rising") {
		const sixHourBaseline = candidate.stats.engagement7d / 28;
		return finite((candidate.stats.engagement6h + 1) / (sixHourBaseline + 2));
	}
	return finite((positive + 5) / (observed + 10 + negative * 2));
}

function percentileById<T extends RecommendationCandidate>(
	candidates: readonly T[],
	value: (candidate: T) => number,
) {
	const scored = candidates.map((candidate) => ({ candidate, value: finite(value(candidate)) }));
	const ordered = scored.sort((left, right) => {
		const difference = left.value - right.value;
		return difference || left.candidate.id.localeCompare(right.candidate.id);
	});
	const denominator = Math.max(1, ordered.length - 1);
	const percentiles = new Map<string, number>();
	for (let start = 0; start < ordered.length;) {
		let end = start + 1;
		while (end < ordered.length && ordered[end]?.value === ordered[start]?.value) end += 1;
		const percentile = (start + end - 1) / 2 / denominator;
		for (let index = start; index < end; index += 1) {
			const entry = ordered[index];
			if (entry) percentiles.set(entry.candidate.id, percentile);
		}
		start = end;
	}
	return percentiles;
}

function freshness(candidate: RecommendationCandidate, asOf: Date) {
	const ageDays = Math.max(0, (asOf.getTime() - candidate.createdAt.getTime()) / 86_400_000);
	return Math.exp(-ageDays / 7);
}

function similarity(left: RecommendationCandidate, right: RecommendationCandidate) {
	if (left.id === right.id) return 1;
	if (left.subjectId && left.subjectId === right.subjectId) return 0.7;
	if (left.creditedUnitIds?.some((unitId) => right.creditedUnitIds?.includes(unitId))) return 0.5;
	if (left.realmId && left.realmId === right.realmId) return 0.3;
	return 0;
}

function exceedsDiversityCap(
	candidate: RecommendationCandidate,
	selected: readonly RecommendationCandidate[],
	scopedRealmId?: string,
) {
	const cap = RecommendationPolicy.pageDiversityCap;
	const matches = (key: "realmId" | "subjectId") => {
		const value = candidate[key];
		return value ? selected.filter((item) => item[key] === value).length >= cap : false;
	};
	const attributionCapped = candidate.creditedUnitIds?.some(
		(unitId) => selected.filter((item) => item.creditedUnitIds?.includes(unitId)).length >= cap,
	);
	return attributionCapped || (!scopedRealmId && matches("realmId")) || matches("subjectId");
}

function applyExploration<T extends RecommendationCandidate>(
	ordered: RankedRecommendation<T>[],
	asOf: Date,
	pageSize: number,
) {
	const count = Math.floor(pageSize * RecommendationPolicy.explorationRatio);
	if (count <= 0 || ordered.length <= pageSize) return ordered;
	const firstPage = ordered.slice(0, pageSize);
	const impressionValues = ordered.map(({ stats }) => stats.impressions).sort((a, b) => a - b);
	const median = impressionValues[Math.floor(impressionValues.length / 2)] ?? 0;
	const exploration = ordered
		.slice(pageSize)
		.filter(
			(candidate) =>
				asOf.getTime() - candidate.createdAt.getTime() <= 7 * 86_400_000 &&
				candidate.stats.impressions <= median,
		)
		.slice(0, count);
	if (!exploration.length) return ordered;
	const inserted = new Set(exploration.map(({ id }) => id));
	const keep = firstPage.slice(0, pageSize - exploration.length);
	const remaining = ordered.filter(
		(candidate) => !keep.some(({ id }) => id === candidate.id) && !inserted.has(candidate.id),
	);
	return [...keep, ...exploration, ...remaining];
}

export function rankRecommendations<T extends RecommendationCandidate>(
	candidates: readonly T[],
	options: {
		sort: RecommendationSort;
		personalized: boolean;
		asOf: Date;
		pageSize: number;
		scopedRealmId?: string;
	},
): RankedRecommendation<T>[] {
	if (!candidates.length) return [];
	const objective = percentileById(candidates, (candidate) =>
		calculateObjective(options.sort, candidate, options.asOf),
	);
	const relevance = percentileById(candidates, (candidate) => candidate.personalizedRelevance);
	const recency = percentileById(candidates, (candidate) => freshness(candidate, options.asOf));
	const configured = SortWeightByKind[options.sort];
	const retainedWeight = configured.objective + configured.freshness;
	const weights = options.personalized
		? configured
		: {
				personalized: 0,
				objective: retainedWeight ? configured.objective / retainedWeight : 1,
				freshness: retainedWeight ? configured.freshness / retainedWeight : 0,
			};
	const base = new Map(
		candidates.map((candidate) => [
			candidate.id,
			finite(
				(relevance.get(candidate.id) ?? 0) * weights.personalized +
					(objective.get(candidate.id) ?? 0) * weights.objective +
					(recency.get(candidate.id) ?? 0) * weights.freshness,
			),
		]),
	);
	const remaining = [...candidates];
	const selected: RankedRecommendation<T>[] = [];
	const maximumSimilarity = new Map(candidates.map(({ id }) => [id, 0]));
	while (remaining.length) {
		const pageStart = Math.floor(selected.length / options.pageSize) * options.pageSize;
		const diversityWindow = selected.slice(pageStart);
		const eligible = remaining.filter(
			(candidate) => !exceedsDiversityCap(candidate, diversityWindow, options.scopedRealmId),
		);
		const pool = eligible.length ? eligible : remaining;
		let next: T | undefined;
		let nextScore = Number.NEGATIVE_INFINITY;
		for (const candidate of pool) {
			const score =
				(base.get(candidate.id) ?? 0) -
				(1 - RecommendationPolicy.mmrLambda) * (maximumSimilarity.get(candidate.id) ?? 0);
			if (
				!next ||
				score > nextScore ||
				(score === nextScore &&
					(candidate.createdAt.getTime() > next.createdAt.getTime() ||
						(candidate.createdAt.getTime() === next.createdAt.getTime() &&
							candidate.id.localeCompare(next.id) > 0)))
			) {
				next = candidate;
				nextScore = score;
			}
		}
		if (!next) break;
		selected.push({
			...next,
			rankScore: nextScore,
		});
		remaining.splice(
			remaining.findIndex(({ id }) => id === next.id),
			1,
		);
		for (const candidate of remaining)
			maximumSimilarity.set(
				candidate.id,
				Math.max(maximumSimilarity.get(candidate.id) ?? 0, similarity(candidate, next)),
			);
	}
	return applyExploration(selected, options.asOf, options.pageSize);
}
