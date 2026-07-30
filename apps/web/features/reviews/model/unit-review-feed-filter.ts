import type { UnitPredicate } from "@rezics/filter";

import type { UnitScore } from "./score-value";

/**
 * Product-owned Review score controls compile into the shared UnitPredicate
 * vocabulary. Realm placement remains a separate SearchDocument control.
 */
export function createReviewScorePredicate(input: {
	readonly realmId?: string;
	readonly scores: readonly UnitScore[];
}): UnitPredicate | undefined {
	if (!input.realmId || input.scores.length === 0) return undefined;
	return {
		post: {
			is: {
				scores: {
					displayed: {
						some: {
							realm: { id: { in: [input.realmId] } },
							value: { in: [...input.scores] },
						},
					},
				},
			},
		},
	};
}
