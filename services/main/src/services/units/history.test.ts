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

	it("undoes one Content Structure node edit while preserving a later node", () => {
		const role = "content-structure/019b1234-1234-7000-8000-000000000001";
		const contentDocuments = (nodes: readonly Record<string, unknown>[]) =>
			({
				[role]: {
					model: "rezics.content-structure.v1",
					payload: { version: 1, structure: { id: "structure" }, nodes },
				},
			}) satisfies UnitRevisionDocuments;
		const before = contentDocuments([{ id: "first", position: "a0" }]);
		const after = contentDocuments([{ id: "first", position: "a1" }]);
		const current = contentDocuments([
			{ id: "first", position: "a1" },
			{ id: "second", position: "a2" },
		]);

		const result = undoRevisionDocuments(before, after, current);

		expect(result.conflictPaths).toEqual([]);
		expect(result.documents[role]?.payload).toEqual({
			version: 1,
			structure: { id: "structure" },
			nodes: [
				{ id: "first", position: "a0" },
				{ id: "second", position: "a2" },
			],
		});
	});
});
