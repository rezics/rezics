import { describe, expect, it } from "vitest";

import type { RenderedTagExpression, TagExpressionRenderSource } from "./tag-expression-renderer";
import { compactTagExpressionTrail, presentTagExpressionTrail } from "./tag-expression-trail";

function source(pathId: string, members: readonly string[]): TagExpressionRenderSource {
	return {
		applicationId: pathId,
		sourceKind: "path",
		pathId,
		members: members.map((title, index) => ({
			nodeId: `${pathId}:${index}`,
			nodeKind: "concept",
			title,
			incomingRelation: index ? { relationKind: "generic" } : null,
		})),
	};
}

function expression(
	displayLabels: readonly string[],
	applications: readonly TagExpressionRenderSource[],
): RenderedTagExpression<TagExpressionRenderSource> {
	const labelComponents = displayLabels.map((title, index) => ({
		tagId: `tag:${index}`,
		semanticRole: (index === displayLabels.length - 1 ? "value" : "qualifier") as
			| "value"
			| "qualifier",
		componentKind: "required" as const,
		title,
	}));
	return {
		key: "global:expression",
		authority: { kind: "global" },
		expressionId: "expression",
		focusTagId: "tag:focus",
		label: displayLabels.join(" · "),
		labelComponents,
		displayParts: displayLabels.map((label, index) => ({
			key: `component:${index}`,
			label,
			source: "component",
		})),
		applications,
		collisionRepair: "none",
	};
}

describe("presentTagExpressionTrail", () => {
	it("uses configured Expression display parts instead of every structural Path member", () => {
		const result = presentTagExpressionTrail(
			expression(
				["Hair", "Curtained"],
				[source("path-1", ["Hair", "Hairstyle", "Bangs", "Curtained"])],
			),
			"Unknown",
		);

		expect(result.label).toBe("Hair › Curtained");
		expect(result.segments.map(({ label }) => label)).toEqual(["Hair", "Curtained"]);
	});

	it("keeps presentation stable when one Expression has multiple structural Paths", () => {
		const result = presentTagExpressionTrail(
			expression(
				["Hair", "Curtained"],
				[
					source("path-1", ["Hair", "Hairstyle", "Curtained"]),
					source("path-2", ["Appearance", "Hair", "Curtained"]),
				],
			),
			"Unknown",
		);

		expect(result.label).toBe("Hair › Curtained");
		expect(result.segments.map(({ label }) => label)).not.toContain("Hairstyle");
	});

	it("falls back to the rendered label when no display parts are available", () => {
		const item = { ...expression([], []), label: "Unknown expression", displayParts: [] };

		expect(presentTagExpressionTrail(item, "Unknown").segments).toEqual([
			{ key: "label:global:expression", label: "Unknown expression" },
		]);
	});
});

describe("compactTagExpressionTrail", () => {
	const segments = presentTagExpressionTrail(
		expression(["Root", "Branch", "Family", "Kind", "Leaf"], []),
		"Unknown",
	).segments;

	it("keeps a four-part presentation complete on wider layouts", () => {
		const fourParts = presentTagExpressionTrail(
			expression(["Root", "Branch", "Kind", "Leaf"], []),
			"Unknown",
		).segments;

		expect(compactTagExpressionTrail(fourParts, 4).map((part) => part.kind)).toEqual([
			"segment",
			"segment",
			"segment",
			"segment",
		]);
	});

	it("keeps the root and useful tail when compacting a long presentation", () => {
		const result = compactTagExpressionTrail(segments, 4);

		expect(result.map((part) => (part.kind === "ellipsis" ? "…" : part.segment.label))).toEqual([
			"Root",
			"…",
			"Kind",
			"Leaf",
		]);
	});
});
