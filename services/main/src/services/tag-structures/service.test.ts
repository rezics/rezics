import { describe, expect, it } from "vitest";

import { InvalidTagStructure } from "../api/tags/errors";
import { nextUnitStructureDefinitionUpdatedAt } from "./definition";
import { toTagStructureConstraintError } from "./service";

describe("Tag structure administrative correction", () => {
	it("advances the optimistic concurrency timestamp even within one millisecond", () => {
		const current = new Date("2026-07-23T12:00:00.123Z");
		expect(nextUnitStructureDefinitionUpdatedAt(current, current.getTime()).toISOString()).toBe(
			"2026-07-23T12:00:00.124Z",
		);
		expect(
			nextUnitStructureDefinitionUpdatedAt(
				current,
				new Date("2026-07-23T12:00:01.000Z").getTime(),
			).toISOString(),
		).toBe("2026-07-23T12:00:01.000Z");
	});
});

describe("Tag structure constraint errors", () => {
	it("maps rejected definitions and immutable projection writes to the public error", () => {
		expect(
			toTagStructureConstraintError({
				cause: {
					code: "23514",
					constraint: "unit_structure_member_count_check",
					message:
						'new row for relation "unit_structure" violates check constraint "unit_structure_member_count_check"',
				},
			}),
		).toBeInstanceOf(InvalidTagStructure);
		expect(
			toTagStructureConstraintError({
				cause: {
					code: "55000",
					message: "Tag hierarchy path definitions are immutable",
				},
			}),
		).toBeInstanceOf(InvalidTagStructure);
	});

	it("does not relabel unrelated database failures", () => {
		expect(
			toTagStructureConstraintError({
				code: "23514",
				message: "unrelated domain constraint",
			}),
		).toBeUndefined();
		expect(toTagStructureConstraintError(new Error("unrelated"))).toBeUndefined();
	});
});
