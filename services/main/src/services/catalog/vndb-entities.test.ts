import { describe, expect, it } from "vitest";
import {
	VndbCharacterSchema,
	VndbProducerSchema,
	VndbStaffSchema,
	planVndbCharacterFacts,
	planVndbStaffNames,
	vndbProducerShape,
} from "./vndb-entities";

describe("VNDB supporting entity conformance", () => {
	it("keeps an individual producer distinct from a company and an amateur collective", () => {
		for (const [type, shape] of [
			["in", "person"],
			["co", "organization"],
			["ng", "collective"],
		] as const) {
			const producer = VndbProducerSchema.parse({ id: "p1", name: "Author", lang: "ja", type });
			expect(vndbProducerShape(producer.type)).toBe(shape);
		}
		expect(
			VndbProducerSchema.safeParse({ id: "p1", name: "Author", lang: "ja", type: "unknown" })
				.success,
		).toBe(false);
	});
	it("preserves alias-specific names even when the selected staff result is not the main name", () => {
		const staff = {
			id: "s1",
			aid: 2,
			ismain: false,
			name: "Alias",
			original: "別名",
			lang: "ja",
			aliases: [
				{ aid: 1, name: "本名", latin: "Name", ismain: true },
				{ aid: 2, name: "別名", latin: "Alias", ismain: false },
			],
		};
		expect(planVndbStaffNames(staff)).toEqual([
			{
				aid: 1,
				value: "本名",
				latin: "Name",
				ismain: true,
				languageTag: null,
				path: "/aliases/0/name",
				aliasPath: "/aliases/0/aid",
				latinPath: "/aliases/0/latin",
			},
			{
				aid: 2,
				value: "別名",
				latin: "Alias",
				ismain: false,
				languageTag: null,
				path: "/aliases/1/name",
				aliasPath: "/aliases/1/aid",
				latinPath: "/aliases/1/latin",
			},
		]);
		expect(VndbStaffSchema.safeParse({ ...staff, aid: 3 }).success).toBe(false);
		expect(
			VndbStaffSchema.safeParse({ ...staff, aliases: [...staff.aliases, staff.aliases[1]] })
				.success,
		).toBe(false);
	});
	it("permits a partial staff projection while retaining the alias identifier", () => {
		expect(
			planVndbStaffNames({
				id: "s1",
				aid: 5,
				ismain: false,
				name: "Pen Name",
				original: null,
				lang: "en",
			})[0],
		).toMatchObject({ aid: 5, value: "Pen Name", latin: null, aliasPath: "/aid" });
	});
	it("keeps unknown measurements distinct from zero and omitted observations", () => {
		const facts = planVndbCharacterFacts({
			id: "c1",
			name: "Character",
			height: null,
			age: 0,
			blood_type: "ab",
		});
		expect(facts.find((value) => value.key === "character.height")).toMatchObject({
			value: null,
			unit: "cm",
		});
		expect(facts.find((value) => value.key === "character.age")).toMatchObject({
			value: 0,
			unit: "year",
		});
		expect(facts.find((value) => value.key === "character.weight")).toBeUndefined();
		expect(facts.find((value) => value.key === "character.blood_type")?.value).toBe("AB");
		expect(VndbCharacterSchema.safeParse({ id: "c1", name: "Character", height: -1 }).success).toBe(
			false,
		);
	});
	it("separates sex from gender and apparent values from spoiler-protected actual values", () => {
		const facts = planVndbCharacterFacts({
			id: "c1",
			name: "Character",
			sex: ["f", "b"],
			gender: ["a", "o"],
		});
		expect(facts).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					key: "character.apparent_sex",
					value: "female",
					spoiler: 0,
					path: "/sex/0",
				}),
				expect.objectContaining({
					key: "character.actual_sex",
					value: "both",
					spoiler: 2,
					path: "/sex/1",
				}),
				expect.objectContaining({
					key: "character.apparent_gender",
					value: "ambiguous",
					spoiler: 0,
					path: "/gender/0",
				}),
				expect.objectContaining({
					key: "character.actual_gender",
					value: "nonbinary",
					spoiler: 2,
					path: "/gender/1",
				}),
			]),
		);
		expect(
			VndbCharacterSchema.safeParse({ id: "c1", name: "Character", sex: ["o", "f"] }).success,
		).toBe(false);
		expect(
			VndbCharacterSchema.safeParse({ id: "c1", name: "Character", gender: ["b", "f"] }).success,
		).toBe(false);
	});
	it("retains explicit unknown pairs and validates recurring birthdays without inventing a year", () => {
		const facts = planVndbCharacterFacts({
			id: "c1",
			name: "Character",
			sex: null,
			gender: [null, "f"],
			birthday: [2, 29],
		});
		expect(facts.find((value) => value.key === "character.actual_sex")).toMatchObject({
			value: null,
			path: "/sex",
		});
		expect(facts.find((value) => value.key === "character.apparent_gender")).toMatchObject({
			value: null,
			path: "/gender/0",
		});
		expect(facts.find((value) => value.key === "character.birthday_day")).toMatchObject({
			value: 29,
			path: "/birthday/1",
		});
		for (const birthday of [
			[2, 30],
			[13, 1],
			[1, 0],
		])
			expect(VndbCharacterSchema.safeParse({ id: "c1", name: "Character", birthday }).success).toBe(
				false,
			);
	});
	it("retains multiple appearances of a character in one VN with distinct release context", () => {
		const appearances = [
			{ id: "v1", role: "main", spoiler: 0, release: null },
			{ id: "v1", role: "side", spoiler: 2, release: { id: "r1" } },
		];
		expect(
			VndbCharacterSchema.parse({ id: "c1", name: "Character", vns: appearances }).vns,
		).toEqual(appearances);
	});
});
