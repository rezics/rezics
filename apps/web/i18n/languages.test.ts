import { describe, expect, it } from "vitest";

import enUS from "@rezics/i18n/languages/en-US";
import zhCN from "@rezics/i18n/languages/zh-CN";

function isTranslationGroup(value: unknown): value is Readonly<Record<string, unknown>> {
	return value !== null && typeof value === "object" && !Array.isArray(value);
}

function assertSameTranslationShape(
	expected: unknown,
	actual: unknown,
	path = "translation",
): void {
	if (!isTranslationGroup(expected)) {
		expect(typeof actual, `${path} has a different value type`).toBe(typeof expected);
		return;
	}

	expect(isTranslationGroup(actual), `${path} must be an object`).toBe(true);
	if (!isTranslationGroup(actual)) return;
	expect(Object.keys(actual), `${path} has different keys`).toEqual(Object.keys(expected));
	for (const key of Object.keys(expected)) {
		assertSameTranslationShape(expected[key], actual[key], `${path}.${key}`);
	}
}

describe("language dictionaries", () => {
	it("keeps the same nested public shape", () => {
		assertSameTranslationShape(zhCN, enUS);
		expect(Object.keys(enUS.errorCodes).every((code) => /^[A-Z][A-Za-z0-9]*$/.test(code))).toBe(
			true,
		);
	});
});
