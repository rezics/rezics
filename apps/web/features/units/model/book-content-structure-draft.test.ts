import { describe, expect, it } from "vitest";

import {
	bookContentStructureDraftFingerprint,
	getBookDraftMoveTargetIds,
	getBookDraftSelectionRoots,
	moveBookDraftSelection,
	renameBookDraftNode,
	createBookContentStructureDraft,
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
		originalTitle: "A",
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
		originalTitle: "B",
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
		originalTitle: "C",
		contentUnitId: "uc",
		contentKind: "label",
		language: "en",
	},
];

describe("Book Content Structure draft", () => {
	it("omits unchanged titles and includes the original value only for intentional child renames", () => {
		expect(toBookContentStructureSaveNodes(nodes).every((node) => !("title" in node))).toBe(true);
		const renamed = renameBookDraftNode(nodes, "b", "Changed chapter");
		expect(toBookContentStructureSaveNodes(renamed).find((node) => node.id === "b")).toMatchObject({
			title: "Changed chapter",
			expectedTitle: "B",
		});
	});
	it("keeps an unnamed native Text Version unnamed while moving it", () => {
		const draft = createBookContentStructureDraft([
			{
				id: "native",
				parentId: null,
				contentUnitId: "native-id",
				contentKind: "text_version",
				language: null,
				languageTag: null,
				title: null,
				position: "a0",
			},
		]);
		expect(renameBookDraftNode(draft, "native", "Invented name")).toEqual(draft);
		expect(toBookContentStructureSaveNodes(draft)).toEqual([
			{ state: "existing", id: "native", parentId: null, order: 0 },
		]);
	});

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
