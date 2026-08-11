import type { UnitPredicate } from "@rezics/filter";

export function createSubjectFeedPredicate(input: {
	readonly kind: "discussion" | "excerpt" | "review";
	readonly subjectId: string;
}): UnitPredicate {
	return {
		post: {
			is: {
				kind: {
					in: [
						input.kind === "discussion" ? "post" : input.kind === "excerpt" ? "excerpt" : "review",
					],
				},
				subject: {
					is: {
						id: { in: [input.subjectId] },
					},
				},
			},
		},
	};
}
