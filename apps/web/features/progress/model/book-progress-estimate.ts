import type { GetApiUnitsBookByUnitIdContentStructureNodesStatus200 } from "@rezics/openapi-tanstack-query";

import {
	buildContentStructureTree,
	flattenContentStructureTree,
} from "@/features/units/content-structure-tree";
import { toNonNegativeApiInteger } from "@/lib/api-number";

type BookContentNode = GetApiUnitsBookByUnitIdContentStructureNodesStatus200["items"][number];

export interface BookProgressEstimate {
	readonly method: "content-metrics" | "chapter-order";
	readonly percentage: number;
}

export interface BookChapterProgressEstimate extends BookProgressEstimate {
	readonly id: string;
}

/**
 * Estimates progress through the selected chapter while keeping labels out of
 * the denominator. Content weighting is used only when every chapter has a
 * usable metric; otherwise deterministic chapter order is the honest fallback.
 */
export function estimateBookChapterProgresses(
	nodes: readonly BookContentNode[],
): readonly BookChapterProgressEstimate[] {
	const chapters = flattenContentStructureTree(buildContentStructureTree(nodes))
		.map(({ node }) => node)
		.filter((node) => node.contentKind === "chapter");
	if (chapters.length === 0) return [];

	const wordCounts = chapters.map((node) => toNonNegativeApiInteger(node.contentMetrics.wordCount));
	const characterCounts = chapters.map((node) =>
		toNonNegativeApiInteger(node.contentMetrics.characterCount),
	);
	const weights = wordCounts.every((value) => value > 0)
		? wordCounts
		: characterCounts.every((value) => value > 0)
			? characterCounts
			: undefined;
	if (weights) {
		const total = weights.reduce((sum, value) => sum + value, 0);
		let completed = 0;
		return chapters.map((chapter, index) => {
			const weight = weights[index];
			if (weight === undefined)
				throw new Error("Chapter progress weights must align with chapter order");
			completed += weight;
			return {
				id: chapter.id,
				method: "content-metrics",
				percentage: Math.round((completed / total) * 100),
			};
		});
	}
	return chapters.map((chapter, index) => ({
		id: chapter.id,
		method: "chapter-order",
		percentage: Math.round(((index + 1) / chapters.length) * 100),
	}));
}

export function estimateBookProgress(
	nodes: readonly BookContentNode[],
	selectedNodeId: string,
): BookProgressEstimate | undefined {
	const estimate = estimateBookChapterProgresses(nodes).find(
		(candidate) => candidate.id === selectedNodeId,
	);
	return estimate ? { method: estimate.method, percentage: estimate.percentage } : undefined;
}
