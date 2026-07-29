import { describe, expect, it } from "vitest";

import {
	InitialFractionalPosition,
	compareFractionalPositions,
	fractionalPositionAt,
	fractionalPositionBetween,
	fractionalPositionsBetween,
	isFractionalPosition,
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
});
