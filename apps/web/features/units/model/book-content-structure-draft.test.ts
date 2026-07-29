import { describe, expect, it } from "vitest";

import {
	bookContentStructureDraftFingerprint,
	getBookDraftMoveTargetIds,
	getBookDraftSelectionRoots,
	moveBookDraftSelection,
	toBookContentStructureSaveNodes,
	type BookDraftNode,
} from "./book-content-structure-draft";

const nodes: BookDraftNode[] = [
	{
		state: "existing",
		id: "a",
		parentId: null,
		order: 0,
		title: "A",
		contentUnitId: "ua",
		contentKind: "label",
		language: "en",
	},
	{
		state: "existing",
		id: "b",
		parentId: "a",
		order: 0,
		title: "B",
		contentUnitId: "ub",
		contentKind: "chapter",
		language: "en",
	},
	{
		state: "existing",
		id: "c",
		parentId: null,
		order: 1,
		title: "C",
		contentUnitId: "uc",
		contentKind: "label",
		language: "en",
	},
];

describe("Book Content Structure draft", () => {
	it("normalizes a selection to roots and blocks their descendants", () => {
		const selection = new Set(["a", "b"]);
		expect(getBookDraftSelectionRoots(nodes, selection).map(({ id }) => id)).toEqual(["a"]);
		expect([...getBookDraftMoveTargetIds(nodes, selection)]).toEqual(["c"]);
	});

	it("moves the selected roots as children while preserving their order", () => {
		const moved = moveBookDraftSelection(nodes, new Set(["a", "c"]), {
			kind: "node",
			nodeId: "b",
			placement: "inside",
		});
		expect(moved).toEqual(nodes);

		const movedToRoot = moveBookDraftSelection(nodes, new Set(["b"]), { kind: "root" });
		expect(movedToRoot.find(({ id }) => id === "b")).toMatchObject({
			parentId: null,
			order: 2,
		});
	});

	it("serializes only the server-owned save contract", () => {
		expect(toBookContentStructureSaveNodes(nodes)[0]).not.toHaveProperty("contentUnitId");
		expect(bookContentStructureDraftFingerprint(nodes)).toBe(
			bookContentStructureDraftFingerprint([...nodes]),
		);
	});

	it("serializes an attached Unit without trusting its presentation", () => {
		const attached: BookDraftNode = {
			state: "attached",
			id: "d",
			parentId: null,
			order: 2,
			title: "Picked presentation",
			contentUnitId: "ud",
			contentKind: "chapter",
			language: "en",
		};

		expect(
			toBookContentStructureSaveNodes([...nodes, attached]).find(
				(node) => node.state === "attached",
			),
		).toEqual({
			state: "attached",
			id: "d",
			parentId: null,
			order: 2,
			contentUnitId: "ud",
		});
	});
});
