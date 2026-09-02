import { describe, expect, it } from "vitest";

import type { RenderedTagExpression, TagExpressionRenderSource } from "./tag-expression-renderer";
import { compactTagExpressionTrail, presentTagExpressionTrail } from "./tag-expression-trail";

function source(
	pathId: string | null,
	members: readonly string[],
	sourceKind: TagExpressionRenderSource["sourceKind"] = "path",
): TagExpressionRenderSource {
	return {
		applicationId: pathId,
		sourceKind,
		pathId,
		members: members.map((title, index) => ({
			nodeId: `${pathId ?? sourceKind}:${index}`,
			nodeKind: "concept",
			title,
			incomingRelation: index ? { relationKind: "generic" } : null,
		})),
	};
}

function expression(
	applications: readonly TagExpressionRenderSource[],
): RenderedTagExpression<TagExpressionRenderSource> {
	return {
		key: "global:expression",
		authority: { kind: "global" },
		expressionId: "expression",
		focusTagId: "curtained",
		label: "Hair · Curtained",
		labelComponents: [
			{
				tagId: "hair",
				semanticRole: "slot",
				componentKind: "required",
				title: "Hair",
			},
			{
				tagId: "curtained",
				semanticRole: "value",
				componentKind: "required",
				title: "Curtained",
			},
		],
		applications,
		collisionRepair: "none",
	};
}

describe("presentTagExpressionTrail", () => {
	it("uses the complete source Path for one Path application", () => {
		const result = presentTagExpressionTrail(
			expression([source("path-1", ["Hair", "Hairstyle", "Bangs", "Curtained"])]),
			"Unknown",
		);

		expect(result.kind).toBe("path");
		expect(result.label).toBe("Hair › Hairstyle › Bangs › Curtained");
		expect(result.segments.map(({ label }) => label)).toEqual([
			"Hair",
			"Hairstyle",
			"Bangs",
			"Curtained",
		]);
	});

	it("uses the Path when repeated applications share its identity", () => {
		const result = presentTagExpressionTrail(
			expression([
				source("path-1", ["Hair", "Hairstyle", "Curtained"]),
				source("path-1", ["Hair", "Hairstyle", "Curtained"]),
			]),
			"Unknown",
		);

		expect(result.kind).toBe("path");
		expect(result.label).toBe("Hair › Hairstyle › Curtained");
	});

	it("keeps a semantic trail when applications use different Paths", () => {
		const result = presentTagExpressionTrail(
			expression([
				source("path-1", ["Hair", "Hairstyle", "Curtained"]),
				source("path-2", ["Appearance", "Hair", "Curtained"]),
			]),
			"Unknown",
		);

		expect(result.kind).toBe("semantic");
		expect(result.label).toBe("Hair · Curtained");
	});

	it("keeps a semantic trail when direct and Path sources are mixed", () => {
		const result = presentTagExpressionTrail(
			expression([
				source("path-1", ["Hair", "Hairstyle", "Curtained"]),
				source(null, [], "direct"),
			]),
			"Unknown",
		);

		expect(result.kind).toBe("semantic");
		expect(result.segments.map(({ label }) => label)).toEqual(["Hair", "Curtained"]);
	});
});

describe("compactTagExpressionTrail", () => {
	const segments = presentTagExpressionTrail(
		expression([source("path-1", ["Root", "Branch", "Family", "Kind", "Leaf"])]),
		"Unknown",
	).segments;

	it("keeps a four-part trail complete on wider layouts", () => {
		const fourParts = presentTagExpressionTrail(
			expression([source("path-1", ["Root", "Branch", "Kind", "Leaf"])]),
			"Unknown",
		).segments;

		expect(compactTagExpressionTrail(fourParts, 4).map((part) => part.kind)).toEqual([
			"segment",
			"segment",
			"segment",
			"segment",
		]);
	});

	it("keeps the root and useful tail when compacting a long trail", () => {
		const result = compactTagExpressionTrail(segments, 4);

		expect(result.map((part) => (part.kind === "ellipsis" ? "…" : part.segment.label))).toEqual([
			"Root",
			"…",
			"Kind",
			"Leaf",
		]);
	});
});
