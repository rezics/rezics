import type {
	GetApiReviewsByReviewIdStatus200,
	GetApiScoresByTargetIdViewerStatus200,
} from "@rezics/openapi-tanstack-query";

import { apiValueToUnitScore, type UnitScore } from "./score-value";

type AttachedScore = GetApiReviewsByReviewIdStatus200["scores"][number];
type ViewerScore = GetApiScoresByTargetIdViewerStatus200["items"][number];

export interface ReviewScoreAssociationOption {
	readonly scoreId: string;
	readonly contextUnitId: string;
	readonly contextLabel: string;
	readonly value: UnitScore;
}

function toOption(
	score: Pick<ViewerScore, "scoreId" | "contextUnitId" | "value">,
	contextLabel: string,
): ReviewScoreAssociationOption | undefined {
	const value = apiValueToUnitScore(score.value);
	return value === undefined
		? undefined
		: {
				scoreId: score.scoreId,
				contextUnitId: score.contextUnitId,
				contextLabel,
				value,
			};
}

export function resolveReviewScoreAssociationOptions(
	viewerScores: readonly ViewerScore[],
	attachedScores: readonly AttachedScore[],
): readonly ReviewScoreAssociationOption[] {
	const options = viewerScores.flatMap((score) => {
		const option = toOption(score, score.contextUnitTitle ?? score.contextUnitId);
		return option ? [option] : [];
	});
	const knownIds = new Set(options.map(({ scoreId }) => scoreId));
	for (const score of attachedScores) {
		if (knownIds.has(score.scoreId)) continue;
		const option = toOption(score, score.contextUnitId);
		if (!option) continue;
		options.push(option);
		knownIds.add(option.scoreId);
	}
	return options;
}
