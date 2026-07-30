import type {
	GetApiReviewsByReviewIdStatus200,
	GetApiScoresByTargetIdViewerStatus200,
} from "@rezics/openapi-tanstack-query";

import { apiValueToUnitScore, type UnitScore } from "./score-value";

type AttachedScore = GetApiReviewsByReviewIdStatus200["scores"][number];
type ViewerScore = GetApiScoresByTargetIdViewerStatus200["items"][number];

export const MaximumReviewScoreAssociations = 5;

interface ReviewScoreDraftBase {
	readonly realmId: string;
	readonly realmLabel: string;
	readonly value: UnitScore | undefined;
}

export interface StoredReviewScoreDraft extends ReviewScoreDraftBase {
	readonly state: "stored";
	readonly scoreId: string;
	readonly persistedValue: UnitScore;
}

export interface NewReviewScoreDraft extends ReviewScoreDraftBase {
	readonly state: "new";
}

export type ReviewScoreDraft = StoredReviewScoreDraft | NewReviewScoreDraft;

export interface ReviewScoreRealmOption {
	readonly realmId: string;
	readonly realmLabel: string;
	readonly scoreId?: string;
	readonly value?: UnitScore;
}

function toRealmLabel(score: ViewerScore): string {
	return score.realmTitle ?? score.realmId;
}

export function createReviewScoreDrafts(
	viewerScores: readonly ViewerScore[],
	attachedScores: readonly AttachedScore[],
): readonly StoredReviewScoreDraft[] {
	const viewerByScoreId = new Map(viewerScores.map((score) => [score.scoreId, score]));
	const viewerByRealmId = new Map(viewerScores.map((score) => [score.realmId, score]));
	const seenRealmIds = new Set<string>();
	return attachedScores
		.flatMap((score): StoredReviewScoreDraft[] => {
			if (seenRealmIds.has(score.realmId)) return [];
			const value = apiValueToUnitScore(score.value);
			if (value === undefined) return [];
			seenRealmIds.add(score.realmId);
			const knownRealm =
				viewerByScoreId.get(score.scoreId) ?? viewerByRealmId.get(score.realmId);
			return [
				{
					state: "stored",
					scoreId: score.scoreId,
					realmId: score.realmId,
					realmLabel: knownRealm
						? toRealmLabel(knownRealm)
						: (score.realmTitle ?? score.realmId),
					value,
					persistedValue: value,
				},
			];
		})
		.slice(0, MaximumReviewScoreAssociations);
}

export function createReviewScoreRealmOptions(
	viewerScores: readonly ViewerScore[],
	excludedRealmIds: ReadonlySet<string>,
): readonly ReviewScoreRealmOption[] {
	return viewerScores.flatMap((score): ReviewScoreRealmOption[] => {
		if (excludedRealmIds.has(score.realmId)) return [];
		const value = apiValueToUnitScore(score.value);
		if (value === undefined) return [];
		return [
			{
				scoreId: score.scoreId,
				realmId: score.realmId,
				realmLabel: toRealmLabel(score),
				value,
			},
		];
	});
}

export function appendReviewScoreDrafts(
	current: readonly ReviewScoreDraft[],
	options: readonly ReviewScoreRealmOption[],
): readonly ReviewScoreDraft[] {
	const result = [...current];
	const knownRealmIds = new Set(result.map(({ realmId }) => realmId));
	for (const option of options) {
		if (result.length >= MaximumReviewScoreAssociations || knownRealmIds.has(option.realmId))
			continue;
		knownRealmIds.add(option.realmId);
		const value = option.value;
		result.push(
			option.scoreId && value !== undefined
				? {
						state: "stored",
						scoreId: option.scoreId,
						realmId: option.realmId,
						realmLabel: option.realmLabel,
						value,
						persistedValue: value,
					}
				: {
						state: "new",
						realmId: option.realmId,
						realmLabel: option.realmLabel,
						value,
					},
		);
	}
	return result;
}

export function moveReviewScoreDraft(
	current: readonly ReviewScoreDraft[],
	realmId: string,
	targetIndex: number,
): readonly ReviewScoreDraft[] {
	const sourceIndex = current.findIndex((item) => item.realmId === realmId);
	if (
		sourceIndex < 0 ||
		targetIndex < 0 ||
		targetIndex >= current.length ||
		sourceIndex === targetIndex
	)
		return current;
	const result = [...current];
	const [item] = result.splice(sourceIndex, 1);
	if (!item) return current;
	result.splice(targetIndex, 0, item);
	return result;
}

export function reviewScoreDraftsAreValid(
	drafts: readonly ReviewScoreDraft[],
): drafts is readonly (ReviewScoreDraft & { readonly value: UnitScore })[] {
	return (
		drafts.length <= MaximumReviewScoreAssociations &&
		new Set(drafts.map(({ realmId }) => realmId)).size === drafts.length &&
		drafts.every(({ value }) => value !== undefined)
	);
}
