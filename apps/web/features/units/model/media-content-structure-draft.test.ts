import { describe, expect, it } from "vitest";

import {
	addMediaDraftNode,
	addMediaDraftNodeAfter,
	buildMediaDraftTree,
	createMediaContentStructureDraft,
	getMediaDraftMoveTargetIds,
	indexMediaDraftSelectionCoverage,
	moveMediaDraftSelection,
	moveMediaDraftNode,
	normalizeMediaDraftSelectionIds,
	toMediaContentStructureSaveNodes,
} from "./media-content-structure-draft";

const remote = [
	{
		id: "video-node",
		parentId: null,
		contentUnitId: "video-unit",
		contentKind: "video" as const,
		language: "en" as const,
		title: "Opening",
		position: "a0",
		durationSeconds: 90,
	},
	{
		id: "label-node",
		parentId: null,
		contentUnitId: "label-unit",
		contentKind: "label" as const,
		language: "en" as const,
		title: "Part one",
		position: "a1",
		durationSeconds: null,
	},
	{
		id: "audio-node",
		parentId: "label-node",
		contentUnitId: "audio-unit",
		contentKind: "audio" as const,
		language: "en" as const,
		title: "Commentary",
		position: "a0",
		durationSeconds: 45,
	},
] as const;

describe("Media Content Structure draft", () => {
	it("preserves timed-media kinds, duration, and hierarchy from the server", () => {
		const draft = createMediaContentStructureDraft(remote);
		const tree = buildMediaDraftTree(draft);

		expect(tree.map(({ node }) => node.id)).toEqual(["video-node", "label-node"]);
		expect(tree[1]?.children[0]?.node).toMatchObject({
			id: "audio-node",
			contentKind: "audio",
			durationSeconds: 45,
		});
	});

	it("serializes title-only creation and attached top-level Unit identity", () => {
		const draft = createMediaContentStructureDraft(remote);
		const withVideo = addMediaDraftNode(draft, {
			state: "new",
			id: "new-video-node",
			parentId: "label-node",
			title: "Second clip",
			contentKind: "video",
			language: "en",
			durationSeconds: null,
		});
		const withAudio = addMediaDraftNode(withVideo, {
			state: "attached",
			id: "attached-audio-node",
			parentId: "label-node",
			title: "Existing audio",
			contentKind: "audio",
			contentUnitId: "existing-audio-unit",
			language: "en",
			durationSeconds: null,
		});

		expect(toMediaContentStructureSaveNodes(withAudio)).toContainEqual({
			state: "new",
			id: "new-video-node",
			parentId: "label-node",
			order: 1,
			title: "Second clip",
			language: "en",
			contentKind: "video",
		});
		expect(toMediaContentStructureSaveNodes(withAudio)).toContainEqual({
			state: "attached",
			id: "attached-audio-node",
			parentId: "label-node",
			order: 2,
			contentUnitId: "existing-audio-unit",
		});
	});

	it("moves one item to a sibling edge without changing its parent", () => {
		const draft = createMediaContentStructureDraft(remote);
		const moved = moveMediaDraftNode(draft, "label-node", "first");

		expect(
			moved
				.filter(({ parentId }) => parentId === null)
				.toSorted((left, right) => left.order - right.order)
				.map(({ id }) => id),
		).toEqual(["label-node", "video-node"]);
		expect(moved.find(({ id }) => id === "audio-node")?.parentId).toBe("label-node");
	});

	it("inserts a new item after the selected leaf", () => {
		const draft = createMediaContentStructureDraft(remote);
		const inserted = addMediaDraftNodeAfter(
			draft,
			{
				state: "new",
				id: "new-audio-node",
				parentId: null,
				title: "Credits",
				contentKind: "audio",
				language: "en",
				durationSeconds: null,
			},
			"video-node",
		);

		expect(
			inserted
				.filter(({ parentId }) => parentId === null)
				.toSorted((left, right) => left.order - right.order)
				.map(({ id }) => id),
		).toEqual(["video-node", "new-audio-node", "label-node"]);
	});

	it("moves a normalized multi-selection while protecting its descendants", () => {
		const draft = createMediaContentStructureDraft(remote);
		const selected = normalizeMediaDraftSelectionIds(
			draft,
			new Set(["label-node", "audio-node"]),
		);
		const coverage = indexMediaDraftSelectionCoverage(draft, selected);

		expect(selected).toEqual(new Set(["label-node"]));
		expect(coverage.get("audio-node")).toBe("label-node");
		expect(getMediaDraftMoveTargetIds(draft, selected)).toEqual(new Set(["video-node"]));

		const moved = moveMediaDraftSelection(draft, selected, {
			kind: "node",
			nodeId: "video-node",
			placement: "after",
		});
		expect(
			moved
				.filter(({ parentId }) => parentId === null)
				.toSorted((left, right) => left.order - right.order)
				.map(({ id }) => id),
		).toEqual(["video-node", "label-node"]);
		expect(moved.find(({ id }) => id === "audio-node")?.parentId).toBe("label-node");
	});
});
