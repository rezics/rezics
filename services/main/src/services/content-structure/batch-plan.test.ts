import { describe, expect, it } from "vitest";

import { ContentStructureSnapshotSchema, type ContentStructureNodeState } from "./contracts";
import { planContentStructureBatch, type ContentStructureBatchCommand } from "./batch-plan";
import {
	compareFractionalPositions,
	fractionalPositionBetween,
	fractionalPositionNeedsRebalance,
} from "../ordering/position";

const StructureId = "019b1234-1234-7000-8000-000000000001";
const OwnerId = "019b1234-1234-7000-8000-000000000002";
const FirstNodeId = "019b1234-1234-7000-8000-000000000003";
const SecondNodeId = "019b1234-1234-7000-8000-000000000004";
const ThirdNodeId = "019b1234-1234-7000-8000-000000000005";
const FirstContentId = "019b1234-1234-7000-8000-000000000006";
const SecondContentId = "019b1234-1234-7000-8000-000000000007";
const ThirdContentId = "019b1234-1234-7000-8000-000000000008";
const CreatedAt = new Date("2026-08-04T00:00:00.000Z");
const UpdatedAt = new Date("2026-08-04T00:01:00.000Z");

function node(input: {
	readonly id: string;
	readonly contentUnitId: string;
	readonly parentId?: string | null;
	readonly position: string;
}): ContentStructureNodeState {
	return {
		id: input.id,
		structureId: StructureId,
		ownerUnitId: OwnerId,
		parentId: input.parentId ?? null,
		contentUnitId: input.contentUnitId,
		documentKey: null,
		targetKind: "content",
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

function snapshot() {
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
		nodes: [
			node({ id: FirstNodeId, contentUnitId: FirstContentId, position: "a0" }),
			node({ id: SecondNodeId, contentUnitId: SecondContentId, position: "a1" }),
		],
	});
}

function pathologicalPosition(): string {
	let position = "a0";
	while (!fractionalPositionNeedsRebalance(position))
		position = fractionalPositionBetween(position, "a1");
	return position;
}

describe("Content Structure batch planner", () => {
	it("plans dependent commands against one final valid tree", () => {
		const plan = planContentStructureBatch(
			snapshot(),
			[
				{
					opId: "create",
					type: "node.create",
					nodeId: ThirdNodeId,
					parentId: null,
					contentUnitId: ThirdContentId,
					placement: { kind: "start" },
				},
				{
					opId: "move",
					type: "node.move",
					nodeId: SecondNodeId,
					parentId: ThirdNodeId,
				},
			],
			UpdatedAt,
		);

		expect(plan.results).toEqual([
			{ opId: "create", applied: true },
			{ opId: "move", applied: true },
		]);
		expect(plan.after.nodes.find(({ id }) => id === SecondNodeId)?.parentId).toBe(ThirdNodeId);
		expect(plan.delta?.operations.some(({ kind }) => kind === "node.insert")).toBe(true);
	});

	it("counts a swap as one command regardless of its physical effects", () => {
		const plan = planContentStructureBatch(
			snapshot(),
			[
				{
					opId: "swap",
					type: "nodes.swap",
					leftNodeId: FirstNodeId,
					rightNodeId: SecondNodeId,
				},
			],
			UpdatedAt,
		);

		expect(plan.results).toHaveLength(1);
		expect(plan.after.nodes.find(({ id }) => id === FirstNodeId)?.position).toBe("a1");
		expect(plan.after.nodes.find(({ id }) => id === SecondNodeId)?.position).toBe("a0");
	});

	it("rejects a cycle created only by the combined batch", () => {
		expect(() =>
			planContentStructureBatch(snapshot(), [
				{
					opId: "first",
					type: "node.move",
					nodeId: FirstNodeId,
					parentId: SecondNodeId,
				},
				{
					opId: "second",
					type: "node.move",
					nodeId: SecondNodeId,
					parentId: FirstNodeId,
				},
			]),
		).toThrow(/cycle/);
	});

	it("never reuses a node identity deleted earlier in the batch", () => {
		expect(() =>
			planContentStructureBatch(snapshot(), [
				{
					opId: "delete",
					type: "node.deleteSubtree",
					nodeId: FirstNodeId,
				},
				{
					opId: "recreate",
					type: "node.create",
					nodeId: FirstNodeId,
					parentId: null,
					contentUnitId: ThirdContentId,
				},
			]),
		).toThrow(/already exists or was already used/);
	});

	it("enforces the limit on logical command entries", () => {
		const command: ContentStructureBatchCommand = {
			opId: "delete",
			type: "node.deleteSubtree",
			nodeId: FirstNodeId,
		};
		expect(() =>
			planContentStructureBatch(
				snapshot(),
				Array.from({ length: 10_001 }, (_, index) => ({
					...command,
					opId: String(index),
				})),
			),
		).toThrow(/10000 commands/);
	});

	it("compacts only the degraded sibling group without changing its order", () => {
		const before = ContentStructureSnapshotSchema.parse({
			...snapshot(),
			nodes: [
				node({
					id: FirstNodeId,
					contentUnitId: FirstContentId,
					position: pathologicalPosition(),
				}),
				node({ id: SecondNodeId, contentUnitId: SecondContentId, position: "a1" }),
			],
		});

		const plan = planContentStructureBatch(before, [
			{
				opId: "unchanged",
				type: "node.update",
				nodeId: FirstNodeId,
				contentUnitId: FirstContentId,
			},
		]);
		const orderedIds = [...plan.after.nodes]
			.sort((left, right) => compareFractionalPositions(left.position, right.position))
			.map(({ id }) => id);

		expect(orderedIds).toEqual([FirstNodeId, SecondNodeId]);
		expect(
			plan.after.nodes.every(({ position }) => !fractionalPositionNeedsRebalance(position)),
		).toBe(true);
	});
});
