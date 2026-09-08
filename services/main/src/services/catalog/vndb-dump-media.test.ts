import { describe, expect, it } from "vitest";
import { vndbDumpLinkUrl, vndbDumpImage, planVndbDumpExternalLinks } from "./vndb-dump-media";

describe("reviewed public VNDB dump media joins", () => {
	it("uses the pinned formatter including zero padding and composed site identifiers", () => {
		expect(vndbDumpLinkUrl("steam", "00042").url).toBe("https://store.steampowered.com/app/42/");
		expect(vndbDumpLinkUrl("digiket", "42").url).toBe(
			"https://www.digiket.com/work/show/_data/ID=ITM0000042/",
		);
		expect(vndbDumpLinkUrl("itch", "creator/title").url).toBe("https://creator.itch.io/title");
		expect(vndbDumpLinkUrl("appstore", "42").url).toBe("https://apps.apple.com/app/id42");
		expect(vndbDumpLinkUrl("playasia", "abc").url).toBe("https://www.play-asia.com/13/70abc");
		expect(() => vndbDumpLinkUrl("unknown-new-site", "42")).toThrow(/Unreviewed/);
		expect(() => vndbDumpLinkUrl("website", "javascript:alert(1)")).toThrow();
	});
	it("converts image rating scale and keeps the exact image identity", () => {
		expect(
			vndbDumpImage({
				id: "cv79412",
				width: 800,
				height: 600,
				c_votecount: 4,
				c_sexual_avg: 125,
				c_violence_avg: 0,
			}),
		).toEqual({
			id: "cv79412",
			url: "https://t.vndb.org/cv/12/79412.jpg",
			dims: [800, 600],
			sexual: 1.25,
			violence: 0,
			votecount: 4,
		});
	});
	it("joins only the parent packet and keeps row-specific evidence paths", () => {
		const links = [{ id: 1, site: "steam", value: "42" }];
		const plan = planVndbDumpExternalLinks(
			"r1",
			[{ id: "r1", link: 1 }],
			links,
			"/releases_extlinks",
		);
		expect(plan.relations[0]?.qualifiers).toContainEqual({
			namespace: "source.vndb.qualifier",
			key: "external-identifier",
			kind: "string",
			value: "42",
			path: "/extlinks/0/value",
		});
		expect(() =>
			planVndbDumpExternalLinks("r1", [{ id: "r2", link: 1 }], links, "/releases_extlinks"),
		).toThrow(/parent/);
		expect(() =>
			planVndbDumpExternalLinks("r1", [{ id: "r1", link: 1 }], [], "/releases_extlinks"),
		).toThrow(/missing/);
		expect(() => planVndbDumpExternalLinks("r1", [], links, "/releases_extlinks")).toThrow(
			/unrelated/,
		);
	});
});
