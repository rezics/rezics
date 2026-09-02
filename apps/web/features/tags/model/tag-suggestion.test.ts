import { describe, expect, it } from "vitest";

import { presentTagSuggestion, type TagSuggestionResponseItem } from "./tag-suggestion";

const ExpressionId = "019fb1ef-a9b2-7a98-8d45-770b04760100";
const TagId = "019fb1ef-a9b2-7a98-8d45-770b04760101";
const PathId = "019fb1ef-a9b2-7a98-8d45-770b04760102";
const SenseId = "019fb1ef-a9b2-7a98-8d45-770b04760103";

function expression(title: string | null) {
	return {
		expressionId: ExpressionId,
		expressionKind: "simple" as const,
		focusTagId: TagId,
		presentationRevision: 1,
		components: [
			{
				tagId: TagId,
				semanticRole: "focus" as const,
				componentKind: "required" as const,
				language: "en" as const,
				title,
			},
		],
		groupKey: null,
	};
}

describe("Tag suggestion presentation", () => {
	it("keeps the server-owned stable key for a direct Tag", () => {
		const item = {
			selection: "direct_expression",
			selectionKey: `expression:${ExpressionId}`,
			expression: expression("Hair"),
			senseId: null,
			pathId: null,
			members: [],
			usageCount: 0,
			match: { kind: "exact", source: "direct_tag", tagId: TagId },
		} satisfies TagSuggestionResponseItem;

		expect(
			presentTagSuggestion(item, {
				unnamedTag: "Unnamed Tag",
				unnamedPathMember: "Unnamed member",
			}),
		).toEqual({
			selectionKey: `expression:${ExpressionId}`,
			kind: "direct_expression",
			tagId: TagId,
			senseId: null,
			label: "Hair",
			pathLabel: null,
			usageCount: 0,
			matchKind: "exact",
			matchSource: "direct_tag",
		});
	});

	it("renders the complete breadcrumb for a path-member match", () => {
		const item = {
			selection: "path_sense",
			selectionKey: `sense:${SenseId}`,
			expression: expression("White"),
			senseId: SenseId,
			pathId: PathId,
			members: [
				{
					ordinal: 0,
					nodeId: TagId,
					nodeKind: "concept",
					incomingRelation: null,
					language: "en",
					title: "Hair",
					summary: null,
					avatar: null,
				},
				{
					ordinal: 1,
					nodeId: "019fb1ef-a9b2-7a98-8d45-770b04760104",
					nodeKind: "concept",
					incomingRelation: {
						relationId: "019fb1ef-a9b2-7a98-8d45-770b04760105",
						relationKind: "facet_value",
					},
					language: "en",
					title: "White",
					summary: null,
					avatar: null,
				},
			],
			usageCount: 27,
			match: { kind: "exact", source: "path_member", tagId: TagId },
		} satisfies TagSuggestionResponseItem;

		const presented = presentTagSuggestion(item, {
			unnamedTag: "Unnamed Tag",
			unnamedPathMember: "Unnamed member",
		});
		expect(presented.pathLabel).toBe("Hair › White");
		expect(presented.selectionKey).toBe(`sense:${SenseId}`);
		expect(presented.matchSource).toBe("path_member");
	});
});
