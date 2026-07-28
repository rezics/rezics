import { describe, expect, it } from "vitest";

import { estimateBookProgress } from "./book-progress-estimate";

const node = (
	id: string,
	input: {
		readonly characterCount?: number;
		readonly contentKind?: "chapter" | "label";
		readonly parentId?: string | null;
		readonly position: string;
		readonly wordCount?: number;
	},
) => ({
	id,
	parentId: input.parentId ?? null,
	contentUnitId: id,
	contentKind: input.contentKind ?? ("chapter" as const),
	language: "en" as const,
	title: id,
	position: input.position,
	contentMetrics: {
		wordCount: input.wordCount ?? 0,
		characterCount: input.characterCount ?? 0,
	},
});

describe("book progress estimation", () => {
	it("weights complete chapter metrics and excludes labels", () => {
		const nodes = [
			node("label", { contentKind: "label", position: "a0" }),
			node("one", { parentId: "label", position: "a0", wordCount: 100 }),
			node("two", { parentId: "label", position: "a1", wordCount: 300 }),
		];
		expect(estimateBookProgress(nodes, "one")).toEqual({
			method: "content-metrics",
			percentage: 25,
		});
	});

	it("falls back to chapter order when metrics are incomplete", () => {
		const nodes = [
			node("one", { position: "a0", wordCount: 100 }),
			node("two", { position: "a1" }),
			node("three", { position: "a2", wordCount: 300 }),
		];
		expect(estimateBookProgress(nodes, "two")).toEqual({
			method: "chapter-order",
			percentage: 67,
		});
	});
});
