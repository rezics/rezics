import { describe, expect, it } from "vitest";

import {
	CollectionStructureCheckpointDepth,
	CollectionStructureContentModel,
	CollectionStructureLargeDeltaBytes,
	CollectionStructureReplayBytes,
	applyCollectionStructureDelta,
	diffCollectionStructureSnapshots,
	parseCollectionStructureSnapshot,
	shouldCheckpointCollectionStructureRevision,
	type CollectionStructureItemState,
} from "./contracts";

const CollectionId = "019b1234-1234-7000-8000-000000000001";
const FirstTargetId = "019b1234-1234-7000-8000-000000000002";
const SecondTargetId = "019b1234-1234-7000-8000-000000000003";
const ThirdTargetId = "019b1234-1234-7000-8000-000000000004";
const ActorId = "019b1234-1234-7000-8000-000000000005";
const AddedAt = new Date("2026-07-29T00:00:00.000Z");

function item(input: { targetUnitId: string; position: string }): CollectionStructureItemState {
	return {
		targetUnitId: input.targetUnitId,
		position: input.position,
		addedByProfileId: ActorId,
		addedAt: AddedAt,
	};
}

function snapshot(items: readonly CollectionStructureItemState[]) {
	return parseCollectionStructureSnapshot({
		version: 1,
		collectionId: CollectionId,
		items,
	});
}

describe("Collection Structure History contract", () => {
	it("replays insert, move, and delete by stable target identity", () => {
		const before = snapshot([
			item({ targetUnitId: FirstTargetId, position: "a0" }),
			item({ targetUnitId: SecondTargetId, position: "a1" }),
		]);
		const after = snapshot([
			item({ targetUnitId: SecondTargetId, position: "a2" }),
			item({ targetUnitId: ThirdTargetId, position: "a3" }),
		]);

		const delta = diffCollectionStructureSnapshots(before, after);

		expect(delta).not.toBeNull();
		expect(applyCollectionStructureDelta(before, delta)).toEqual(after);
		expect(CollectionStructureContentModel).toBe("rezics.collection-structure.v1");
	});

	it("does not create a delta for an exact semantic no-op", () => {
		const current = snapshot([item({ targetUnitId: FirstTargetId, position: "a0" })]);

		expect(diffCollectionStructureSnapshots(current, current)).toBeNull();
	});

	it("rejects replay when the completed delta before-state does not match", () => {
		const before = snapshot([item({ targetUnitId: FirstTargetId, position: "a0" })]);
		const after = snapshot([item({ targetUnitId: FirstTargetId, position: "a1" })]);
		const delta = diffCollectionStructureSnapshots(before, after);
		const changedBase = snapshot([item({ targetUnitId: FirstTargetId, position: "a2" })]);

		expect(() => applyCollectionStructureDelta(changedBase, delta)).toThrow(/base changed/);
	});

	it("rejects duplicate positions", () => {
		expect(() =>
			snapshot([
				item({ targetUnitId: FirstTargetId, position: "a0" }),
				item({ targetUnitId: SecondTargetId, position: "a0" }),
			]),
		).toThrow(/duplicate position/);
	});

	it("creates adaptive checkpoints at every replay bound", () => {
		const decide = (
			overrides: Partial<Parameters<typeof shouldCheckpointCollectionStructureRevision>[0]>,
		) =>
			shouldCheckpointCollectionStructureRevision({
				currentDeltaDepth: 0,
				currentReplayByteSize: 0,
				checkpointByteSize: 512 * 1024,
				deltaByteSize: 1,
				...overrides,
			});

		expect(decide({})).toBe(false);
		expect(decide({ currentDeltaDepth: CollectionStructureCheckpointDepth - 1 })).toBe(true);
		expect(decide({ deltaByteSize: CollectionStructureLargeDeltaBytes })).toBe(true);
		expect(
			decide({
				currentReplayByteSize: CollectionStructureReplayBytes - 1,
				deltaByteSize: 1,
			}),
		).toBe(true);
		expect(decide({ checkpointByteSize: 10, currentReplayByteSize: 9, deltaByteSize: 1 })).toBe(
			true,
		);
		expect(decide({ forceCheckpoint: true })).toBe(true);
	});
});
