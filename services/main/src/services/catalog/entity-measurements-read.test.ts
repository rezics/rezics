import { describe, it, expect } from "vitest";
import { projectNativeMeasurements } from "./entity-measurements-read";
const ownerId = "019f7c24-7a80-7000-8000-000000000001";
const fact = (key: string, value: string | null, count = 1) => ({
	owner_id: ownerId,
	key,
	candidate_count: count,
	kind: value === null ? "null" : "number",
	number_value: value,
});
describe("native measurement presentation", () => {
	it("uses declared cm/kg meaning and preserves explicit zero separately from unknown", () => {
		expect(
			projectNativeMeasurements(
				[ownerId],
				[
					fact("character.height", "170"),
					fact("character.weight", "0"),
					fact("character.bust", null),
				],
			).get(ownerId),
		).toEqual({
			contextUnitId: null,
			heightMillimetres: 1700,
			weightGrams: 0,
			bustMillimetres: null,
			waistMillimetres: null,
			hipsMillimetres: null,
		});
	});
	it("does not choose one conflicting adopted claim or coerce incomplete history into a value", () => {
		const actual = projectNativeMeasurements(
			[ownerId],
			[
				fact("character.height", "170"),
				fact("character.height", "171"),
				fact("character.weight", "70", 65),
				fact("character.waist", "60"),
				fact("character.waist", "60"),
			],
		).get(ownerId);
		expect(actual?.heightMillimetres).toBeNull();
		expect(actual?.weightGrams).toBeNull();
		expect(actual?.waistMillimetres).toBe(600);
	});
	it("omits an owner without current measurement evidence and rejects unsafe numeric conversion", () => {
		expect(projectNativeMeasurements([ownerId], []).size).toBe(0);
		expect(
			projectNativeMeasurements([ownerId], [fact("character.weight", "9007199254740991")]).get(
				ownerId,
			)?.weightGrams,
		).toBeNull();
	});
});
