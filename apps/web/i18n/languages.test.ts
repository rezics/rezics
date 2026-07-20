import { describe, expect, it } from "vitest";
import { create } from "native-i18n";
import { resources } from "@rezics/i18n/resources";

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
	it("keeps the same nested public shape", async () => {
		const i18n = create(resources);
		const namespaces = [
			"betterAuthErrorCodes",
			"errorCodes",
			"errors",
			"locale",
			"settings",
		] as const;
		const english = await i18n.getTranslation(namespaces, ["en"]);
		const traditionalChinese = await i18n.getTranslation(namespaces, ["zh-Hant"]);

		assertSameTranslationShape(traditionalChinese.t, english.t);
		expect(
			Object.keys(english.t.errorCodes).every((code) => /^[A-Z][A-Za-z0-9]*$/.test(code)),
		).toBe(true);
		expect(traditionalChinese.locale.current).toBe("zh-Hant");
		expect(traditionalChinese.t.locale.zh).toBe("繁體中文");
	});
});
