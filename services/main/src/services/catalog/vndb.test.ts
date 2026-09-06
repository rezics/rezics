import { describe, expect, it } from "vitest";
import { VndbVnSchema, vndbLanguage } from "./vndb";
import { canonicalizeContentLanguageTag } from "@rezics/content-language";

describe("VNDB catalog contracts", () => {
	it("retains zero-based VN-local edition IDs and alias-specific staff context", () => {
		const vn = VndbVnSchema.parse({
			id: "v17",
			title: "Fixture",
			editions: [{ eid: 0, lang: null, name: "Edition", official: true }],
			staff: [{ id: "s545", aid: 1008, eid: null, role: "director", note: null }],
			va: [{ staff: { id: "s566", aid: 1037 }, character: { id: "c32" }, note: null }],
		});
		expect(vn.editions?.[0]?.eid).toBe(0);
		expect(vn.staff?.[0]?.aid).toBe(1008);
		expect(vn.staff?.[0]?.eid).toBeNull();
		expect(vn.va?.[0]?.character.id).toBe("c32");
	});
	it("keeps provider language mappings local to VNDB", () => {
		expect(vndbLanguage("ta")).toBe("tl");
		expect(vndbLanguage("ck")).toBe("chr");
		expect(canonicalizeContentLanguageTag("ta")).toBe("ta");
		expect(vndbLanguage("zh-Hant")).toBe("zh-Hant");
	});
});
