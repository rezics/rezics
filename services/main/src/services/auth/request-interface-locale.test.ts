import { describe, expect, it } from "vitest";

import { resolveRequestUiLocale } from "./request-interface-locale";

describe("request interface locale", () => {
	it("preserves an explicit supported locale from the locale cookie", () => {
		const headers = new Headers({
			cookie: "session=opaque; NEXT_LOCALE=zh-Hans",
			"accept-language": "en-US, en;q=0.9",
		});

		expect(resolveRequestUiLocale(headers)).toBe("zh-Hans");
	});

	it.each([
		["zh-CN,zh;q=0.9,en;q=0.8", "zh-Hans"],
		["zh-SG,zh;q=0.9", "zh-Hans"],
		["zh-TW,zh;q=0.9,en;q=0.8", "zh-Hant"],
		["zh-HK,zh;q=0.9", "zh-Hant"],
	] as const)("matches %s to %s", (acceptLanguage, expected) => {
		expect(resolveRequestUiLocale(new Headers({ "accept-language": acceptLanguage }))).toBe(
			expected,
		);
	});

	it("ignores an invalid locale cookie and uses the request language", () => {
		const headers = new Headers({
			cookie: "NEXT_LOCALE=unsupported",
			"accept-language": "ja-JP",
		});

		expect(resolveRequestUiLocale(headers)).toBe("ja");
	});

	it("uses the product fallback when the request has no supported locale", () => {
		expect(resolveRequestUiLocale(new Headers({ "accept-language": "pt-BR,pt;q=0.9" }))).toBe(
			"zh-Hant",
		);
	});
});
