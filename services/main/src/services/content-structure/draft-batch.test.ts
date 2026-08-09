import { describe, expect, it } from "vitest";

import {
	fractionalPositionBetween,
	fractionalPositionNeedsRebalance,
	fractionalPositionsBetween,
} from "../ordering/position";
import {
	assertContentStructureDraftCommandLimit,
	deletedDraftSubtreeRootIds,
	planDraftSiblingPositions,
} from "./draft-batch";

describe("complete Content Structure draft command accounting", () => {
	it("counts an omitted subtree as one command rather than affected nodes", () => {
		const current = Array.from({ length: 20_000 }, (_, index) => ({
			id: String(index),
			parentId: index === 0 ? null : String(index - 1),
		}));
		const deletedNodeIds = new Set(current.map(({ id }) => id));

		expect(deletedDraftSubtreeRootIds(current, deletedNodeIds)).toEqual(["0"]);
		expect(() =>
			assertContentStructureDraftCommandLimit({
				currentNodes: current,
				deletedNodeIds,
				changedDesiredNodeCount: 0,
			}),
		).not.toThrow();
	});

	it("rejects more than 10,000 compiled logical commands", () => {
		expect(() =>
			assertContentStructureDraftCommandLimit({
				currentNodes: [],
				deletedNodeIds: new Set(),
				changedDesiredNodeCount: 10_001,
			}),
		).toThrow(/more than 10000 commands/);
	});

	it("reorders one member in a large sibling list without renumbering the list", () => {
		const positions = fractionalPositionsBetween(null, null, 20_000);
		const current = positions.map((position, index) => ({
			id: String(index),
			parentId: null,
			position,
		}));
		const desiredIds = ["19999", ...current.slice(0, -1).map(({ id }) => id)];
		const planned = planDraftSiblingPositions({
			currentNodes: current,
			desiredNodes: desiredIds.map((id, order) => ({ id, parentId: null, order })),
		});

		const repositionedIds = current
			.filter(({ id, position }) => planned.get(id) !== position)
			.map(({ id }) => id);
		expect(repositionedIds).toEqual(["19999"]);
		expect(() =>
			assertContentStructureDraftCommandLimit({
				currentNodes: current,
				deletedNodeIds: new Set(),
				changedDesiredNodeCount: repositionedIds.length,
			}),
		).not.toThrow();
	});

	it("compacts a degraded sibling group before compiling draft changes", () => {
		let degraded = "a0";
		while (!fractionalPositionNeedsRebalance(degraded))
			degraded = fractionalPositionBetween(degraded, "a1");
		const current = [
			{ id: "first", parentId: null, position: degraded },
			{ id: "second", parentId: null, position: "a1" },
		];

		const planned = planDraftSiblingPositions({
			currentNodes: current,
			desiredNodes: current.map(({ id, parentId }, order) => ({ id, parentId, order })),
		});

		expect(planned.get("first")).not.toBe(degraded);
		expect(
			[...planned.values()].every((position) => !fractionalPositionNeedsRebalance(position)),
		).toBe(true);
	});
});
