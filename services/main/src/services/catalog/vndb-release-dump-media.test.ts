import { describe, expect, it } from "vitest";
import { planVndbDumpReleaseSemantics } from "./vndb-dump";
const packet = {
	release: {
		id: "r1",
		olang: "ja",
		gtin: "0",
		released: 0,
		voiced: 0,
		reso_x: 0,
		reso_y: 0,
		minage: null,
		patch: false,
		freeware: false,
		uncensored: null,
		official: true,
		has_ero: false,
		catalog: "",
		notes: "",
		engine: null,
	},
	titles: [{ id: "r1", lang: "ja", title: "作品", latin: null, mtl: false }],
	release_images: [
		{ id: "r1", img: "cv1", vid: "v1", itype: "pkgfront", lang: ["ja", "en"], photo: true },
	],
	images: [
		{ id: "cv1", width: 600, height: 400, c_votecount: 2, c_sexual_avg: 100, c_violence_avg: 0 },
	],
	links: [{ id: "r1", link: 1 }],
	extlinks: [{ id: 1, site: "website", value: "https://example.invalid/" }],
};
describe("VNDB release dump images and links", () => {
	it("keeps each language context and ignores the non-public photograph flag", () => {
		const plan = planVndbDumpReleaseSemantics(packet);
		const images = plan.relations.filter((relation) => relation.key === "has-image");
		expect(images).toHaveLength(2);
		expect(
			images.map(
				(image) => image.qualifiers.find((value) => value.key === "image-source-language")?.value,
			),
		).toEqual(["ja", "en"]);
		expect(
			images.flatMap((image) => image.qualifiers).some((value) => value.key === "is-photograph"),
		).toBe(false);
		for (const relation of plan.relations)
			for (const path of [
				relation.path,
				...relation.qualifiers.map((value) => value.path),
				...relation.participants.map((value) => value.target.path),
			]) {
				let value: unknown = packet;
				for (const part of path.slice(1).split("/"))
					value =
						value !== null && typeof value === "object" ? Reflect.get(value, part) : undefined;
				expect(value, path).not.toBeUndefined();
			}
	});
	it("rejects missing, unrelated and cross-release rows", () => {
		expect(() => planVndbDumpReleaseSemantics({ ...packet, images: [] })).toThrow(/missing/);
		expect(() => planVndbDumpReleaseSemantics({ ...packet, release_images: [] })).toThrow(
			/unrelated/,
		);
		expect(() =>
			planVndbDumpReleaseSemantics({
				...packet,
				release_images: [{ ...packet.release_images[0], id: "r2" }],
			}),
		).toThrow(/another release/);
	});
});
