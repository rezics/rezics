import { describe, expect, it } from "vitest";
import { normalizeVndbEntityDump } from "./vndb-entity-dump";
import { planVndbSupportingSemantics, VndbSupportingRecordSchema } from "./vndb-supporting-plans";
import { remapVndbSemanticPlan } from "./vndb-semantics";

const packet = {
	staff: { id: "s1", gender: "", lang: "ja", main: 2, description: "A group", prod: "p1" },
	aliases: [
		{ id: "s1", aid: 1, name: "Alias", latin: null },
		{ id: "s1", aid: 2, name: "団体", latin: "Dantai" },
	],
	links: [{ id: "s1", link: 1 }],
	extlinks: [{ id: 1, site: "website", value: "https://example.invalid/" }],
};
describe("VNDB assembled entity dump", () => {
	it("joins main and alternate aliases without fabricating private staff classification", () => {
		const result = normalizeVndbEntityDump("staff", packet);
		expect(result.record.name).toBe("Dantai");
		expect(result.record).not.toHaveProperty("stype");
		expect(result.sourcePath("/description")).toBe("/staff/description");
		expect(result.sourcePath("/name")).toBe("/aliases/1/latin");
		expect(result.extraSemantics.relations.map((relation) => relation.key)).toEqual([
			"external-link",
			"has-linked-producer-profile",
		]);
	});
	it("rejects missing, repeated and cross-owner alias joins", () => {
		expect(() =>
			normalizeVndbEntityDump("staff", { ...packet, aliases: [packet.aliases[0]] }),
		).toThrow(/missing/);
		expect(() =>
			normalizeVndbEntityDump("staff", {
				...packet,
				aliases: [...packet.aliases, packet.aliases[1]],
			}),
		).toThrow();
		expect(() =>
			normalizeVndbEntityDump("staff", {
				...packet,
				aliases: packet.aliases.map((row) => ({ ...row, id: "s2" })),
			}),
		).toThrow(/owner/);
	});
	it("retains producer direction, source row ownership, names and exact relation pointers", () => {
		const result = normalizeVndbEntityDump("producer", {
			producer: {
				id: "p1",
				type: "co",
				lang: "ja",
				name: "会社",
				latin: "Company",
				alias: "Old\nOther",
				description: "Profile",
			},
			relations: [{ id: "p1", pid: "p2", relation: "sub" }],
			links: [],
			extlinks: [],
		});
		const record = VndbSupportingRecordSchema.parse({ ...result.record, objectType: "producer" });
		const plan = remapVndbSemanticPlan(planVndbSupportingSemantics(record), result.sourcePath);
		expect(plan.relations[0]?.participants[0]?.target.path).toBe("/relations/0/pid");
		expect(result.sourcePath("/aliases/1")).toBe("/producer/alias");
		expect(result.sourcePath("/original")).toBe("/producer/name");
	});
});
