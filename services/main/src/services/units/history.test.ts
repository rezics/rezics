import { describe, expect, it } from "vitest";

import { type UnitRevisionDocuments, undoRevisionDocuments } from "./history";

function documents(payload: unknown): UnitRevisionDocuments {
	return { main: { model: "test.v1", payload } };
}

describe("revision undo merge", () => {
	it("reverts the target change while preserving later unrelated edits", () => {
		const result = undoRevisionDocuments(
			documents({ title: "before", score: 0 }),
			documents({ title: "after", score: 0 }),
			documents({ title: "after", score: 1 }),
		);

		expect(result.conflictPaths).toEqual([]);
		expect(result.documents.main?.payload).toEqual({ title: "before", score: 1 });
	});

	it("reports the exact path when a later edit overlaps the target change", () => {
		const result = undoRevisionDocuments(
			documents({ title: "before" }),
			documents({ title: "after" }),
			documents({ title: "later" }),
		);

		expect(result.conflictPaths).toEqual(["/main/payload/title"]);
	});

	it("merges localization arrays by their stable language key", () => {
		const before = documents({
			items: [
				{ language: "en", title: "before" },
				{ language: "zh", title: "原文" },
			],
		});
		const after = documents({
			items: [
				{ language: "en", title: "after" },
				{ language: "zh", title: "原文" },
			],
		});
		const current = documents({
			items: [
				{ language: "en", title: "after" },
				{ language: "zh", title: "后续编辑" },
			],
		});

		const result = undoRevisionDocuments(before, after, current);

		expect(result.conflictPaths).toEqual([]);
		expect(result.documents.main?.payload).toEqual({
			items: [
				{ language: "en", title: "before" },
				{ language: "zh", title: "后续编辑" },
			],
		});
	});
});
