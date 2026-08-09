import { describe, expect, it } from "vitest";

import {
	InitialFractionalPosition,
	FractionalPositionCapacityExceeded,
	FractionalPositionRebalanceThresholdBytes,
	FractionalPositionStorageMaximumBytes,
	compareFractionalPositions,
	fractionalPositionNeedsRebalance,
	fractionalPositionAt,
	fractionalPositionBetween,
	fractionalPositionsBetween,
	isFractionalPosition,
	isStorageSafeFractionalPosition,
	rebalanceFractionalPositionSequence,
	rebalancedFractionalPositions,
} from "./position";

describe("fractional positions", () => {
	it("recognizes only keys accepted by the canonical generator", () => {
		expect(InitialFractionalPosition).toBe("a0");
		expect(isFractionalPosition("a0")).toBe(true);
		expect(isFractionalPosition("a0V")).toBe(true);
		expect(isFractionalPosition("a0019a123456787abc0123456789abcdefV")).toBe(true);
		expect(isFractionalPosition("V")).toBe(false);
		expect(isFractionalPosition("00000000")).toBe(false);
	});

	it("generates positions before, between, and after existing positions", () => {
		const before = fractionalPositionBetween(null, InitialFractionalPosition);
		const after = fractionalPositionBetween(InitialFractionalPosition, null);
		const between = fractionalPositionBetween(InitialFractionalPosition, after);

		expect(compareFractionalPositions(before, InitialFractionalPosition)).toBeLessThan(0);
		expect(compareFractionalPositions(InitialFractionalPosition, between)).toBeLessThan(0);
		expect(compareFractionalPositions(between, after)).toBeLessThan(0);
	});

	it("creates deterministic positions from dense ordinals at owned boundaries", () => {
		expect([0, 1, 2].map(fractionalPositionAt)).toEqual(["a0", "a1", "a2"]);
		expect(() => fractionalPositionAt(-1)).toThrow(RangeError);
	});

	it("creates one ordered run for atomic multi-item moves", () => {
		const after = fractionalPositionBetween(InitialFractionalPosition, null);
		const positions = fractionalPositionsBetween(InitialFractionalPosition, after, 3);

		expect(positions).toHaveLength(3);
		expect(
			[InitialFractionalPosition, ...positions, after].every(
				(position, index, values) =>
					index === 0 || compareFractionalPositions(values[index - 1]!, position) < 0,
			),
		).toBe(true);
		expect(() => fractionalPositionsBetween(null, null, -1)).toThrow(RangeError);
	});

	it("compacts pathological insertion gaps before the indexed storage ceiling", () => {
		let position = InitialFractionalPosition;
		while (!fractionalPositionNeedsRebalance(position))
			position = fractionalPositionBetween(position, "a1");

		expect(position.length).toBeGreaterThan(FractionalPositionRebalanceThresholdBytes);
		expect(position.length).toBeLessThanOrEqual(FractionalPositionStorageMaximumBytes);
		expect(isStorageSafeFractionalPosition(position)).toBe(true);

		const compact = rebalancedFractionalPositions(4_096);
		expect(compact).toHaveLength(4_096);
		expect(Math.max(...compact.map(({ length }) => length))).toBeLessThan(10);
		expect(
			compact.every(
				(candidate, index) =>
					index === 0 || compareFractionalPositions(compact[index - 1]!, candidate) < 0,
			),
		).toBe(true);
	});

	it("compacts the smallest sufficient window instead of rewriting a large owner scope", () => {
		const positions = rebalancedFractionalPositions(20_000);
		const degradedIndex = 10_000;
		const after = positions[degradedIndex + 1];
		let degraded = positions[degradedIndex];
		if (!degraded || !after) throw new Error("Position fixture is incomplete");
		while (!fractionalPositionNeedsRebalance(degraded))
			degraded = fractionalPositionBetween(degraded, after);
		positions[degradedIndex] = degraded;

		const plan = rebalanceFractionalPositionSequence(positions);

		expect(plan.changedIndexes).toEqual([degradedIndex]);
		expect(plan.positions[degradedIndex]).not.toBe(degraded);
		expect(plan.positions[degradedIndex - 1]).toBe(positions[degradedIndex - 1]);
		expect(plan.positions[degradedIndex + 1]).toBe(after);
	});

	it("fails before a generated key can exceed the persisted byte ceiling", () => {
		let position = InitialFractionalPosition;
		expect(() => {
			for (;;) position = fractionalPositionBetween(position, "a1");
		}).toThrow(FractionalPositionCapacityExceeded);
		expect(position.length).toBeLessThanOrEqual(FractionalPositionStorageMaximumBytes);
	});
});
