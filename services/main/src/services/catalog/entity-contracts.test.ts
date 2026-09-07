import { describe, expect, it } from "vitest";
import {
	AreaCodeSchema,
	CreateEntitySchema,
	EntityProfileSchema,
	ReferenceProfileSchema,
} from "./entity-contracts";

describe("native supporting catalog contracts", () => {
	it("keeps same-named person, collective, imprint and character distinctions", () => {
		for (const shape of [
			"person",
			"organization",
			"character",
			"label",
			"collective",
			"unresolved",
		])
			expect(
				CreateEntitySchema.parse({ shape, name: { languageTag: "EN", value: "A" } }),
			).toMatchObject({
				shape,
				name: { languageTag: "en" },
				profile: { begin: null, ended: null },
			});
	});
	it("preserves unknown dates and rejects impossible known dates", () => {
		expect(EntityProfileSchema.parse({ begin: { year: null, month: 2, day: 29 } }).begin).toEqual({
			year: null,
			month: 2,
			day: 29,
			text: null,
		});
		expect(
			EntityProfileSchema.safeParse({ begin: { year: 2023, month: 2, day: 29 } }).success,
		).toBe(false);
	});
	it("does not collapse missing and explicit cancellation or ending", () => {
		expect(ReferenceProfileSchema.parse({ shape: "event" })).toMatchObject({
			cancelled: null,
			ended: null,
		});
		expect(
			ReferenceProfileSchema.parse({ shape: "event", cancelled: false, ended: true }),
		).toMatchObject({ cancelled: false, ended: true });
	});
	it("requires coordinate pairs and bounded coordinates", () => {
		for (const input of [
			{ latitude: 3 },
			{ latitude: 91, longitude: 0 },
			{ latitude: NaN, longitude: 0 },
		])
			expect(ReferenceProfileSchema.safeParse({ shape: "place", ...input }).success).toBe(false);
		expect(
			ReferenceProfileSchema.parse({ shape: "place", latitude: 0, longitude: 0 }),
		).toMatchObject({ latitude: 0, longitude: 0 });
	});
	it("retains historical areas and place lifespans independently from event scheduling", () => {
		for (const shape of ["area", "place"])
			expect(
				ReferenceProfileSchema.parse({
					shape,
					begin: { year: 1900, month: null, day: null },
					ended: true,
				}),
			).toMatchObject({ begin: { year: 1900, month: null, day: null }, ended: true });
	});
	it("checks local clock values without inventing an offset", () => {
		for (const localTime of ["24:00", "12:60", "12:20:60", "12:00Z"])
			expect(ReferenceProfileSchema.safeParse({ shape: "event", localTime }).success).toBe(false);
		expect(
			ReferenceProfileSchema.parse({ shape: "event", localTime: "12:20:03.123456" }),
		).toMatchObject({ localTime: "12:20:03.123456" });
	});
	it("enforces byte bounds and rejects source key leakage", () => {
		expect(AreaCodeSchema.safeParse({ namespace: "a", code: "界".repeat(43) }).success).toBe(false);
		expect(
			CreateEntitySchema.safeParse({
				shape: "person",
				name: { languageTag: null, value: "A" },
				source: "vndb",
			}).success,
		).toBe(false);
	});
});
