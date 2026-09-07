import { describe, expect, it } from "vitest";
import { vndbContextValueKey } from "./vndb-contexts-update";

describe("VNDB snapshot-local context correspondence", () => {
	it("does not use eid or source officialness as native context identity", () => {
		const value = { eid: 1, name: "Translation staff", lang: "en", official: false };
		expect(vndbContextValueKey(value)).toBe(
			vndbContextValueKey({ ...value, eid: 9, official: true }),
		);
		expect(vndbContextValueKey(value)).not.toBe(vndbContextValueKey({ ...value, lang: "fr" }));
		expect(vndbContextValueKey(value)).not.toBe(
			vndbContextValueKey({ ...value, name: "Another group" }),
		);
	});
	it("maps source language labels before comparing contextual values", () => {
		expect(vndbContextValueKey({ eid: 0, name: "Staff", lang: "ta", official: true })).toBe(
			JSON.stringify(["Staff", "tl"]),
		);
		expect(vndbContextValueKey({ eid: 0, name: "", lang: null, official: false })).toBe(
			JSON.stringify([null, null]),
		);
	});
});
