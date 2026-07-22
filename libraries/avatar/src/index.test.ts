import { describe, expect, it } from "vitest";

import {
	fontAwesomeIconClassNames,
	isFontAwesomeIconName,
	isFontAwesomeIconPrefix,
	isFontAwesomeLicense,
	isSingleEmojiGrapheme,
} from "./index";

describe("Font Awesome references", () => {
	it("accepts only configured styles and safe icon names", () => {
		expect(isFontAwesomeIconPrefix("fas")).toBe(true);
		expect(isFontAwesomeIconPrefix("fab")).toBe(true);
		expect(isFontAwesomeIconPrefix("fad")).toBe(false);
		expect(isFontAwesomeLicense("free")).toBe(true);
		expect(isFontAwesomeLicense("pro")).toBe(true);
		expect(isFontAwesomeLicense("enterprise")).toBe(false);
		expect(isFontAwesomeIconName("500px")).toBe(true);
		expect(isFontAwesomeIconName("arrow-up-right-from-square")).toBe(true);
		expect(isFontAwesomeIconName("user solid")).toBe(false);
	});

	it("maps persisted prefixes to the hosted CSS classes", () => {
		expect(fontAwesomeIconClassNames({ prefix: "fab", name: "500px" })).toEqual([
			"fa-brands",
			"fa-500px",
			"fa-fw",
		]);
	});
});

describe("isSingleEmojiGrapheme", () => {
	it.each(["🦈", "🏳️‍🌈", "👨‍👩‍👧‍👦", "🇹🇼", "1️⃣"])("accepts %s", (value) => {
		expect(isSingleEmojiGrapheme(value)).toBe(true);
	});

	it.each(["", "A", "🦈🦈", "hello", "©"])("rejects %s", (value) => {
		expect(isSingleEmojiGrapheme(value)).toBe(false);
	});
});
