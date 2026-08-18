import { describe, expect, it } from "vitest";

import {
	ContentStructureContentModel,
	ContentStructureCheckpointDepth,
	ContentStructureKindPolicies,
	ContentStructureLargeDeltaBytes,
	ContentStructureReplayBytes,
	ContentStructureSnapshotSchema,
	applyContentStructureDelta,
	diffContentStructureSnapshots,
	shouldCheckpointContentStructureRevision,
	type ContentStructureNodeState,
} from "./contracts";

const StructureId = "019b1234-1234-7000-8000-000000000001";
const OwnerId = "019b1234-1234-7000-8000-000000000002";
const FirstNodeId = "019b1234-1234-7000-8000-000000000003";
const SecondNodeId = "019b1234-1234-7000-8000-000000000004";
const FirstContentId = "019b1234-1234-7000-8000-000000000005";
const SecondContentId = "019b1234-1234-7000-8000-000000000006";
const CreatedAt = new Date("2026-07-21T00:00:00.000Z");

function node(input: {
	id: string;
	contentUnitId: string;
	parentId?: string | null;
	position: string;
}): ContentStructureNodeState {
	return {
		id: input.id,
		structureId: StructureId,
		ownerUnitId: OwnerId,
		parentId: input.parentId ?? null,
		contentUnitId: input.contentUnitId,
		documentKey: null,
		targetKind: "content" as const,
		targetUnitId: null,
		targetUrl: null,
		position: input.position,
		contentRating: null,
		realmTagQueryStrategy: null,
		deletedAt: null,
		createdAt: CreatedAt,
		updatedAt: CreatedAt,
	};
}

function snapshot(nodes: readonly ReturnType<typeof node>[]) {
	return ContentStructureSnapshotSchema.parse({
		version: 1,
		structure: {
			id: StructureId,
			ownerUnitId: OwnerId,
			kind: "post.contents",
			documentKey: null,
			deletedAt: null,
			createdAt: CreatedAt,
			updatedAt: CreatedAt,
		},
		nodes,
	});
}

describe("Content Structure History contract", () => {
	it("replays a semantic delta by stable node identity", () => {
		const before = snapshot([
			node({ id: FirstNodeId, contentUnitId: FirstContentId, position: "a0" }),
		]);
		const after = snapshot([
			{
				...before.nodes[0]!,
				position: "a1",
				updatedAt: new Date("2026-07-21T00:01:00.000Z"),
			},
			node({
				id: SecondNodeId,
				contentUnitId: SecondContentId,
				parentId: FirstNodeId,
				position: "a0",
			}),
		]);
		const delta = diffContentStructureSnapshots(before, after);

		expect(delta).not.toBeNull();
		expect(applyContentStructureDelta(before, delta)).toEqual(after);
		expect(ContentStructureContentModel).toBe("rezics.content-structure.v1");
	});

	it("does not create a History component change for an exact no-op", () => {
		const current = snapshot([
			node({ id: FirstNodeId, contentUnitId: FirstContentId, position: "a0" }),
		]);

		expect(diffContentStructureSnapshots(current, current)).toBeNull();
	});

	it("creates adaptive checkpoints at every replay bound", () => {
		const decide = (
			overrides: Partial<Parameters<typeof shouldCheckpointContentStructureRevision>[0]>,
		) =>
			shouldCheckpointContentStructureRevision({
				currentDeltaDepth: 0,
				currentReplayByteSize: 0,
				checkpointByteSize: 512 * 1024,
				deltaByteSize: 1,
				...overrides,
			});

		expect(decide({})).toBe(false);
		expect(decide({ currentDeltaDepth: ContentStructureCheckpointDepth - 1 })).toBe(true);
		expect(decide({ deltaByteSize: ContentStructureLargeDeltaBytes })).toBe(true);
		expect(
			decide({
				currentReplayByteSize: ContentStructureReplayBytes - 1,
				deltaByteSize: 1,
			}),
		).toBe(true);
		expect(decide({ checkpointByteSize: 10, currentReplayByteSize: 9, deltaByteSize: 1 })).toBe(
			true,
		);
		expect(decide({ forceCheckpoint: true })).toBe(true);
	});

	it("uses a tombstone when a structure is deleted", () => {
		const before = snapshot([
			node({ id: FirstNodeId, contentUnitId: FirstContentId, position: "a0" }),
		]);
		const delta = diffContentStructureSnapshots(before, null);

		expect(delta).not.toBeNull();
		expect(applyContentStructureDelta(before, delta)).toEqual({
			version: 1,
			deleted: true,
			structureId: StructureId,
		});
	});

	it("preserves cycles while rejecting malformed discriminated targets at the History boundary", () => {
		const first = node({
			id: FirstNodeId,
			contentUnitId: FirstContentId,
			parentId: SecondNodeId,
			position: "a0",
		});
		const second = node({
			id: SecondNodeId,
			contentUnitId: SecondContentId,
			parentId: FirstNodeId,
			position: "a1",
		});
		expect(snapshot([first, second]).nodes).toEqual([first, second]);
		expect(() =>
			snapshot([
				{
					...node({
						id: FirstNodeId,
						contentUnitId: FirstContentId,
						position: "a0",
					}),
					targetKind: "unit",
					targetUnitId: null,
				},
			]),
		).toThrow(/target shape/);
	});

	it("allows same-domain Unit content without enabling Software contents", () => {
		expect(ContentStructureKindPolicies["book.contents"].acceptsContent("book", null)).toBe(true);
		expect(ContentStructureKindPolicies["media.contents"].acceptsContent("media")).toBe(true);
		expect(ContentStructureKindPolicies["book.contents"].acceptsContent("media", null)).toBe(false);
		expect("software.contents" in ContentStructureKindPolicies).toBe(false);
	});

	it("keeps same-domain container occurrences progress-neutral", () => {
		expect(ContentStructureKindPolicies["book.contents"].contributesProgress("book", null)).toBe(
			false,
		);
		expect(
			ContentStructureKindPolicies["book.contents"].contributesProgress("post", "chapter"),
		).toBe(true);
		expect(ContentStructureKindPolicies["media.contents"].contributesProgress("media", null)).toBe(
			false,
		);
		expect(ContentStructureKindPolicies["media.contents"].contributesProgress("video", null)).toBe(
			true,
		);
	});

	it("validates a deep parent chain without recursive stack growth", () => {
		const nodes = Array.from({ length: 10_000 }, (_, index) =>
			node({
				id: `019b1234-1234-7000-8000-${String(index + 100).padStart(12, "0")}`,
				contentUnitId: FirstContentId,
				parentId:
					index === 0 ? null : `019b1234-1234-7000-8000-${String(index + 99).padStart(12, "0")}`,
				position: "a0",
			}),
		);
		expect(snapshot(nodes).nodes).toHaveLength(10_000);
	});
});
