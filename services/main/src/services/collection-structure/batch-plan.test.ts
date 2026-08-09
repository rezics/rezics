import { describe, expect, it } from "vitest";

import { parseCollectionStructureSnapshot } from "./contracts";
import { planCollectionBatch, type CollectionBatchCommand } from "./batch-plan";
import {
	compareFractionalPositions,
	fractionalPositionBetween,
	fractionalPositionNeedsRebalance,
} from "../ordering/position";

const CollectionId = "019b1234-1234-7000-8000-000000000001";
const FirstTargetId = "019b1234-1234-7000-8000-000000000002";
const SecondTargetId = "019b1234-1234-7000-8000-000000000003";
const ThirdTargetId = "019b1234-1234-7000-8000-000000000004";
const ReviewTargetId = "019b1234-1234-7000-8000-000000000005";
const ActorId = "019b1234-1234-7000-8000-000000000006";
const AddedAt = new Date("2026-08-04T00:00:00.000Z");

function snapshot() {
	return parseCollectionStructureSnapshot({
		version: 1,
		collectionId: CollectionId,
		items: [
			{
				targetUnitId: FirstTargetId,
				position: "a0",
				addedByProfileId: ActorId,
				addedAt: AddedAt,
			},
			{
				targetUnitId: SecondTargetId,
				position: "a1",
				addedByProfileId: ActorId,
				addedAt: AddedAt,
			},
		],
	});
}

function order(plan: ReturnType<typeof planCollectionBatch>) {
	return [...plan.after.items]
		.sort((left, right) => compareFractionalPositions(left.position, right.position))
		.map(({ targetUnitId }) => targetUnitId);
}

function pathologicalPosition(): string {
	let position = "a0";
	while (!fractionalPositionNeedsRebalance(position))
		position = fractionalPositionBetween(position, "a1");
	return position;
}

describe("Collection Structure batch planner", () => {
	it("plans mixed add, move, and remove commands as one revision delta", () => {
		const plan = planCollectionBatch({
			before: snapshot(),
			actorProfileId: ActorId,
			reviewSubjectByTargetId: new Map(),
			commands: [
				{ opId: "add", type: "item.add", targetId: ThirdTargetId },
				{
					opId: "move",
					type: "items.move",
					targetIds: [ThirdTargetId],
					placement: { kind: "start" },
				},
				{ opId: "remove", type: "item.remove", targetId: SecondTargetId },
			],
		});

		expect(order(plan)).toEqual([ThirdTargetId, FirstTargetId]);
		expect(plan.results).toHaveLength(3);
		expect(plan.delta?.operations.some(({ kind }) => kind === "item.insert")).toBe(true);
		expect(plan.delta?.operations.some(({ kind }) => kind === "item.delete")).toBe(true);
	});

	it("keeps Review subject insertion inside one logical add command", () => {
		const plan = planCollectionBatch({
			before: snapshot(),
			actorProfileId: ActorId,
			reviewSubjectByTargetId: new Map([[ReviewTargetId, ThirdTargetId]]),
			commands: [{ opId: "review", type: "item.add", targetId: ReviewTargetId }],
		});

		expect(order(plan)).toEqual([FirstTargetId, SecondTargetId, ThirdTargetId, ReviewTargetId]);
		expect(plan.results).toHaveLength(1);
	});

	it("counts a swap as one command", () => {
		const plan = planCollectionBatch({
			before: snapshot(),
			actorProfileId: ActorId,
			reviewSubjectByTargetId: new Map(),
			commands: [
				{
					opId: "swap",
					type: "items.swap",
					leftTargetId: FirstTargetId,
					rightTargetId: SecondTargetId,
				},
			],
		});

		expect(order(plan)).toEqual([SecondTargetId, FirstTargetId]);
		expect(plan.results).toHaveLength(1);
	});

	it("enforces the limit on commands rather than affected members", () => {
		const command: CollectionBatchCommand = {
			opId: "remove",
			type: "item.remove",
			targetId: FirstTargetId,
		};
		expect(() =>
			planCollectionBatch({
				before: snapshot(),
				actorProfileId: ActorId,
				reviewSubjectByTargetId: new Map(),
				commands: Array.from({ length: 10_001 }, (_, index) => ({
					...command,
					opId: String(index),
				})),
			}),
		).toThrow(/10000 commands/);
	});

	it("compacts a degraded order inside the owned Collection snapshot", () => {
		const before = parseCollectionStructureSnapshot({
			version: 1,
			collectionId: CollectionId,
			items: [
				{
					targetUnitId: FirstTargetId,
					position: pathologicalPosition(),
					addedByProfileId: ActorId,
					addedAt: AddedAt,
				},
				{
					targetUnitId: SecondTargetId,
					position: "a1",
					addedByProfileId: ActorId,
					addedAt: AddedAt,
				},
			],
		});

		const plan = planCollectionBatch({
			before,
			actorProfileId: ActorId,
			reviewSubjectByTargetId: new Map(),
			commands: [{ opId: "existing", type: "item.add", targetId: FirstTargetId }],
		});

		expect(order(plan)).toEqual([FirstTargetId, SecondTargetId]);
		expect(
			plan.after.items.every(({ position }) => !fractionalPositionNeedsRebalance(position)),
		).toBe(true);
	});
});
