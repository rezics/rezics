import { describe, expect, it } from "vitest";

import {
	planBookContentStructureDraft,
	resolveChapterOwnershipMode,
	type CurrentBookDraftNode,
} from "./book-draft-plan";

const current: CurrentBookDraftNode[] = [
	{ id: "a", parentId: null, position: "a0", title: "A" },
	{ id: "b", parentId: null, position: "a1", title: "B" },
	{ id: "c", parentId: "a", position: "a0", title: "C" },
];

describe("Book Content Structure draft planning", () => {
	it("uses the explicit Chapter ownership override before the Book default", () => {
		expect(resolveChapterOwnershipMode("community_owned", undefined)).toBe("community_owned");
		expect(resolveChapterOwnershipMode("profile_owned", undefined)).toBe("profile_owned");
		expect(resolveChapterOwnershipMode("community_owned", "profile_owned")).toBe("profile_owned");
		expect(resolveChapterOwnershipMode("profile_owned", "community_owned")).toBe("community_owned");
	});

	it("recognizes a semantic no-op without rewriting positions", () => {
		const result = planBookContentStructureDraft(current, [
			{ state: "existing", id: "a", parentId: null, order: 0, title: "A" },
			{ state: "existing", id: "b", parentId: null, order: 1, title: "B" },
			{ state: "existing", id: "c", parentId: "a", order: 0, title: "C" },
		]);

		expect(result.hasChanges).toBe(false);
		expect(result.nodes.map(({ id, position }) => ({ id, position }))).toEqual([
			{ id: "a", position: "a0" },
			{ id: "b", position: "a1" },
			{ id: "c", position: "a0" },
		]);
	});

	it("reindexes only sibling lists changed by a multi-node move", () => {
		const result = planBookContentStructureDraft(current, [
			{ state: "existing", id: "a", parentId: null, order: 0, title: "A" },
			{ state: "existing", id: "b", parentId: "a", order: 1, title: "B" },
			{ state: "existing", id: "c", parentId: "a", order: 0, title: "C" },
		]);

		expect(result.hasStructuralChanges).toBe(true);
		expect(result.nodes.find(({ id }) => id === "a")?.position).toBe("a0");
		expect(result.nodes.find(({ id }) => id === "b")?.parentId).toBe("a");
	});

	it("accepts new chapters in the same closed draft", () => {
		const result = planBookContentStructureDraft(current, [
			{ state: "existing", id: "a", parentId: null, order: 0, title: "A" },
			{ state: "existing", id: "b", parentId: null, order: 1, title: "B" },
			{ state: "existing", id: "c", parentId: "a", order: 0, title: "C" },
			{
				state: "new",
				id: "d",
				parentId: "a",
				order: 1,
				title: "D",
				language: "en",
				contentKind: "chapter",
				content: [],
				status: "draft",
			},
		]);

		expect(result.hasChanges).toBe(true);
		expect(result.nodes.find(({ id }) => id === "d")?.state).toBe("new");
	});

	it("accepts attached content Units as new structure nodes", () => {
		const result = planBookContentStructureDraft(current, [
			{ state: "existing", id: "a", parentId: null, order: 0, title: "A" },
			{ state: "existing", id: "b", parentId: null, order: 1, title: "B" },
			{ state: "existing", id: "c", parentId: "a", order: 0, title: "C" },
			{
				state: "attached",
				id: "d",
				parentId: "a",
				order: 1,
				title: "D",
				contentUnitId: "unit-d",
			},
		]);

		expect(result.hasStructuralChanges).toBe(true);
		expect(result.nodes.find(({ id }) => id === "d")).toMatchObject({
			state: "attached",
			contentUnitId: "unit-d",
		});
	});

	it("treats omitted existing nodes as deletions", () => {
		const result = planBookContentStructureDraft(current, [
			{ state: "existing", id: "a", parentId: null, order: 0, title: "A" },
		]);

		expect(result.deletedNodeIds).toEqual(new Set(["b", "c"]));
		expect(result.hasStructuralChanges).toBe(true);
	});

	it("rejects gaps and cycles", () => {
		expect(() =>
			planBookContentStructureDraft(current, [
				{ state: "existing", id: "a", parentId: null, order: 0, title: "A" },
				{ state: "existing", id: "b", parentId: null, order: 2, title: "B" },
				{ state: "existing", id: "c", parentId: "a", order: 0, title: "C" },
			]),
		).toThrow();
		expect(() =>
			planBookContentStructureDraft(current, [
				{ state: "existing", id: "a", parentId: "c", order: 0, title: "A" },
				{ state: "existing", id: "b", parentId: null, order: 0, title: "B" },
				{ state: "existing", id: "c", parentId: "a", order: 0, title: "C" },
			]),
		).toThrow(/cycle/);
	});

	it("rejects an out-of-bounds order before allocating a sparse sibling list", () => {
		expect(() =>
			planBookContentStructureDraft(current, [
				{ state: "existing", id: "a", parentId: null, order: 1_000_000, title: "A" },
				{ state: "existing", id: "b", parentId: null, order: 0, title: "B" },
				{ state: "existing", id: "c", parentId: "a", order: 0, title: "C" },
			]),
		).toThrow(/invalid sibling order/);
	});
});
