import { describe, expect, it } from "vitest";
import {
	VndbSupportingRecordSchema,
	planVndbSupportingNames,
	planVndbSupportingSemantics,
	vndbCharacterPropertyDefinitions,
} from "./vndb-supporting-plans";

describe("VNDB supporting object update plans", () => {
	it("keeps staff alias identity through main-name changes and pins romanization derivation", () => {
		const record = VndbSupportingRecordSchema.parse({
			objectType: "staff",
			id: "s1",
			aid: 1,
			ismain: true,
			name: "Shin",
			original: "新",
			lang: "ja",
			aliases: [
				{ aid: 1, name: "新", latin: "Shin", ismain: true },
				{ aid: 2, name: "旧", latin: null, ismain: false },
			],
		});
		const plan = planVndbSupportingNames(record);
		expect(plan.map((item) => item.key)).toEqual(["1", "1/latin", "2"]);
		expect(plan[1]).toMatchObject({
			derivationKey: "1",
			fields: { origin: "transliteration", languageTag: null },
		});
		expect(plan[0]?.fields.languageTag).toBeNull();
	});
	it("uses explicit source title originals and retains duplicate alias occurrences", () => {
		const record = VndbSupportingRecordSchema.parse({
			objectType: "producer",
			id: "p1",
			type: "co",
			lang: "ja",
			name: "Shin",
			original: "新",
			aliases: ["Alias", "Alias"],
		});
		const plan = planVndbSupportingNames(record);
		expect(plan[1]).toMatchObject({ key: "latin", derivationKey: "primary" });
		expect(new Set(plan.map((item) => item.key)).size).toBe(4);
	});
	it("retains scalar spoiler scopes and the same native measurement constraints", () => {
		const record = VndbSupportingRecordSchema.parse({
			objectType: "character",
			id: "c1",
			name: "Character",
			height: 170,
			gender: ["m", "f"],
			birthday: [2, 29],
		});
		const plan = planVndbSupportingSemantics(record);
		expect(plan.facts.find((item) => item.key === "character.actual_gender")).toMatchObject({
			namespace: "catalog",
			spoiler: 2,
			value: "female",
			path: "/gender/1",
		});
		expect(
			vndbCharacterPropertyDefinitions.find((item) => item.key === "character.height"),
		).toMatchObject({ constraints: { unit: "cm", integer: true, minimum: 0 } });
	});
	it("represents quotation content without manufacturing a display title", () => {
		const record = VndbSupportingRecordSchema.parse({
			objectType: "quote",
			id: "q1",
			quote: "An actual quotation",
			vn: { id: "v1" },
			character: null,
		});
		expect(planVndbSupportingNames(record)).toEqual([]);
		expect(
			planVndbSupportingSemantics(record).facts.find((item) => item.key === "quotation-text")
				?.value,
		).toBe("An actual quotation");
	});
});
