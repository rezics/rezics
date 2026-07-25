import type { ContentLanguage } from "@rezics/i18n";

import { UnitScoreValues, type UnitScore } from "./score-value";

export interface ReviewRealmFilter {
	readonly id: string;
	readonly label: string;
}

export interface ReviewFilterModel {
	readonly languages: readonly ContentLanguage[];
	readonly realm?: ReviewRealmFilter;
	readonly scores: readonly UnitScore[];
}

export const EmptyReviewFilters: ReviewFilterModel = {
	languages: [],
	scores: [],
};

export function toggleReviewScore(filters: ReviewFilterModel, score: UnitScore): ReviewFilterModel {
	const selectedScores = new Set(filters.scores);
	if (selectedScores.has(score)) selectedScores.delete(score);
	else selectedScores.add(score);
	return {
		...filters,
		scores: UnitScoreValues.filter((candidate) => selectedScores.has(candidate)),
	};
}

export function parseReviewScoreFilters(values: readonly string[]): UnitScore[] {
	const selectedValues = new Set(values);
	return UnitScoreValues.filter((score) => selectedValues.has(String(score)));
}

export function reviewFilterCount(filters: ReviewFilterModel): number {
	return filters.languages.length + filters.scores.length + Number(Boolean(filters.realm));
}

export function hasReviewFilters(filters: ReviewFilterModel): boolean {
	return reviewFilterCount(filters) > 0;
}
