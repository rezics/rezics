import type { GetApiUnitsMediaByUnitIdContentStructureNodesStatus200 } from "@rezics/openapi-tanstack-query";

import {
	buildContentStructureTree,
	flattenContentStructureTree,
} from "@/features/units/content-structure-tree";
import { toNonNegativeApiInteger } from "@/lib/api-number";

type MediaContentNode = GetApiUnitsMediaByUnitIdContentStructureNodesStatus200["items"][number];

export interface MediaItemProgressEstimate {
	readonly id: string;
	readonly method: "duration" | "item-order";
	readonly percentage: number;
}

/**
 * Estimates progress through explicit Video and Audio occurrences. Media and
 * Label occurrences are navigation-only and stay out of the denominator.
 * Duration weighting is used only when every playable item has a usable
 * duration; otherwise deterministic item order is the honest fallback.
 */
export function estimateMediaItemProgresses(
	nodes: readonly MediaContentNode[],
): readonly MediaItemProgressEstimate[] {
	const items = flattenContentStructureTree(buildContentStructureTree(nodes))
		.map(({ node }) => node)
		.filter((node) => node.contentKind === "video" || node.contentKind === "audio");
	if (items.length === 0) return [];

	const durations = items.map((node) => toNonNegativeApiInteger(node.durationSeconds));
	if (durations.every((duration) => duration > 0)) {
		const total = durations.reduce((sum, duration) => sum + duration, 0);
		let completed = 0;
		return items.map((item, index) => {
			const duration = durations[index];
			if (duration === undefined)
				throw new Error("Media progress durations must align with item order");
			completed += duration;
			return {
				id: item.id,
				method: "duration",
				percentage: Math.round((completed / total) * 100),
			};
		});
	}

	return items.map((item, index) => ({
		id: item.id,
		method: "item-order",
		percentage: Math.round(((index + 1) / items.length) * 100),
	}));
}
