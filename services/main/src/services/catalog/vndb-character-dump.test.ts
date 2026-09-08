import { describe, expect, it } from "vitest";
import { normalizeVndbCharacterDump } from "./vndb-character-dump";
import { planVndbSupportingSemantics, VndbSupportingRecordSchema } from "./vndb-supporting-plans";
import { remapVndbSemanticPlan } from "./vndb-semantics";

const packet = {
	character: {
		id: "c1",
		image: "ch21",
		bloodt: "unknown",
		cup_size: "",
		sex: "m",
		spoil_sex: "f",
		gender: null,
		spoil_gender: null,
		main: "c2",
		main_spoil: 2,
		s_bust: 0,
		s_waist: 0,
		s_hip: 0,
		birthday: 229,
		height: 170,
		weight: 0,
		age: null,
		description: "Character",
	},
	names: [
		{ id: "c1", lang: "ja", name: "人物", latin: "Jinbutsu" },
		{ id: "c1", lang: "en", name: "Character", latin: null },
	],
	aliases: [{ id: "c1", spoil: 2, name: "Secret", latin: "Secret romanization" }],
	traits: [{ id: "c1", tid: "i1", spoil: 1, lie: true }],
	vns: [{ id: "c1", vid: "v1", rid: "r1", role: "main", spoil: 1 }],
	images: [
		{ id: "ch21", width: 600, height: 800, c_votecount: 2, c_sexual_avg: 125, c_violence_avg: 50 },
	],
};
describe("VNDB character public dump", () => {
	it("preserves localized names, transliteration derivation and spoiler-qualified aliases", () => {
		const result = normalizeVndbCharacterDump(packet);
		expect(result.names[0]?.fields).toMatchObject({
			languageTag: "ja",
			value: "人物",
			primaryForLanguage: true,
		});
		expect(result.names[1]?.derivationKey).toBe(result.names[0]?.key);
		expect(result.names.at(-1)?.fields.spoiler).toBe(2);
		expect(result.record).toMatchObject({
			height: 170,
			weight: 0,
			bust: null,
			birthday: [2, 29],
			sex: ["m", "f"],
			gender: ["m", "f"],
		});
		expect(result.extraSemantics.relations[0]).toMatchObject({
			key: "instance-of-character",
			spoiler: 2,
		});
	});
	it("maps every native evidence pointer into its original dump row", () => {
		const result = normalizeVndbCharacterDump(packet);
		const plan = remapVndbSemanticPlan(
			planVndbSupportingSemantics(
				VndbSupportingRecordSchema.parse({ ...result.record, objectType: "character" }),
			),
			result.sourcePath,
		);
		const paths = [
			...result.names.map((name) => name.path),
			...plan.facts.map((fact) => fact.path),
			...plan.relations.flatMap((relation) => [
				relation.path,
				...relation.qualifiers.map((fact) => fact.path),
				...relation.participants.map((participant) => participant.target.path),
			]),
		];
		for (const path of paths) {
			let value: unknown = packet;
			for (const segment of path.slice(1).split("/"))
				value =
					value !== null && typeof value === "object" ? Reflect.get(value, segment) : undefined;
			expect(value, path).not.toBeUndefined();
		}
		expect(result.sourcePath("/gender/1")).toBe("/character/spoil_sex");
		expect(result.sourcePath("/vns/0/release/id")).toBe("/vns/0/rid");
	});
	it("rejects missing image dependencies, cross-owner rows, duplicate names and impossible birthdays", () => {
		expect(() => normalizeVndbCharacterDump({ ...packet, images: [] })).toThrow(/image join/);
		expect(() =>
			normalizeVndbCharacterDump({ ...packet, aliases: [{ ...packet.aliases[0], id: "c2" }] }),
		).toThrow(/owner/);
		expect(() =>
			normalizeVndbCharacterDump({ ...packet, names: [...packet.names, packet.names[0]] }),
		).toThrow(/Duplicate/);
		expect(() =>
			normalizeVndbCharacterDump({ ...packet, character: { ...packet.character, birthday: 230 } }),
		).toThrow(/birthday/);
	});
	it("retains repeated appearance rows rather than inventing a dump uniqueness constraint", () => {
		const result = normalizeVndbCharacterDump({
			...packet,
			vns: [...packet.vns, { ...packet.vns[0], role: "side", spoil: 2 }],
		});
		expect(result.record.vns).toHaveLength(2);
	});
});
