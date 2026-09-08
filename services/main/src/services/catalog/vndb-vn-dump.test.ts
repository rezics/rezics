import { describe, expect, it } from "vitest";
import { normalizeVndbVnDump } from "./vndb-vn-dump";
import { planVndbParticipation } from "./vndb-participation";
import { planVndbSemantics } from "./vndb-semantics-contracts";
import { remapVndbSemanticPlan } from "./vndb-semantics";
const packet = {
	anime: [],
	vn: {
		id: "v1",
		image: null,
		c_image: "cv1",
		olang: "ja",
		c_votecount: 2,
		c_rating: 750,
		c_average: 800,
		c_length: 120,
		c_lengthnum: 3,
		length: 2,
		devstatus: 0,
		alias: "Alias",
		description: "Description",
	},
	titles: [{ id: "v1", lang: "ja", official: true, title: "作品", latin: "Work" }],
	editions: [{ id: "v1", lang: "en", eid: 2, official: false, name: "English staff" }],
	staff: [{ id: "v1", aid: 10, role: "translator", eid: 2, note: "Translation" }],
	seiyuu: [{ id: "v1", aid: 11, cid: "c1", note: "Voice" }],
	staff_alias: [
		{ id: "s2", aid: 10, name: "翻訳者", latin: "Translator" },
		{ id: "s3", aid: 11, name: "Actor", latin: null },
	],
	relations: [{ id: "v1", vid: "v2", relation: "seq", official: false }],
	screenshots: [{ id: "v1", scr: "sf21", rid: "r1" }],
	images: ["cv1", "sf21"].map((id) => ({
		id,
		width: 600,
		height: 400,
		c_votecount: 2,
		c_sexual_avg: 100,
		c_violence_avg: 0,
	})),
	links: [{ id: "v1", link: 1 }],
	extlinks: [{ id: 1, site: "website", value: "https://example.invalid/" }],
};
describe("VNDB public VN dump assembly", () => {
	it("joins global alias IDs to staff identities and keeps snapshot-local context separate", () => {
		const result = normalizeVndbVnDump(packet);
		const credits = planVndbParticipation(result.record, result.sourcePath);
		expect(credits[0]).toMatchObject({
			staffId: "s2",
			aliasId: 10,
			contextKey: "2",
			path: "/staff/0",
			staffPath: "/staff_alias/0/id",
		});
		expect(credits[1]).toMatchObject({
			staffId: "s3",
			aliasId: 11,
			contextKey: null,
			path: "/seiyuu/0",
			staffPath: "/staff_alias/1/id",
			characterPath: "/seiyuu/0/cid",
		});
		expect(result.record).toMatchObject({
			length_minutes: 120,
			length_votes: 3,
			average: 80,
			rating: 75,
		});
	});
	it("resolves every semantic evidence pointer into the original joined packet", () => {
		const result = normalizeVndbVnDump(packet);
		const plan = remapVndbSemanticPlan(planVndbSemantics(result.record), result.sourcePath);
		const paths = [
			...plan.facts.map((fact) => fact.path),
			...[...plan.relations, ...result.extraSemantics.relations].flatMap((relation) => [
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
		expect(result.sourcePath("/screenshots/0/release/id")).toBe("/screenshots/0/rid");
		expect(result.sourcePath("/image/dims/0")).toBe("/images/0/width");
	});
	it("rejects mismatched, duplicate, missing and unrelated dependency rows", () => {
		expect(() => normalizeVndbVnDump({ ...packet, staff_alias: [packet.staff_alias[0]] })).toThrow(
			/missing/,
		);
		expect(() =>
			normalizeVndbVnDump({
				...packet,
				staff_alias: [...packet.staff_alias, { id: "s4", aid: 12, name: "Unrelated", latin: null }],
			}),
		).toThrow(/unrelated/);
		expect(() =>
			normalizeVndbVnDump({ ...packet, staff: [{ ...packet.staff[0], id: "v2" }] }),
		).toThrow(/owner/);
		expect(() => normalizeVndbVnDump({ ...packet, images: [packet.images[0]] })).toThrow(/missing/);
		expect(() =>
			normalizeVndbVnDump({ ...packet, editions: [...packet.editions, packet.editions[0]] }),
		).toThrow(/Duplicate/);
	});
	it("keeps a distinct editorial image as an explicit source-purpose relation", () => {
		const result = normalizeVndbVnDump({
			...packet,
			vn: { ...packet.vn, image: "cv2" },
			images: [...packet.images, { ...packet.images[0], id: "cv2" }],
		});
		const editorial = result.extraSemantics.relations.find(
			(relation) => relation.key === "has-image",
		);
		expect(editorial?.path).toBe("/vn/image");
		expect(
			editorial?.qualifiers.find((qualifier) => qualifier.key === "image-purpose")?.value,
		).toBe("source-editorial");
		expect(editorial?.participants[0]?.target.path).toBe("/images/2/id");
	});
});
