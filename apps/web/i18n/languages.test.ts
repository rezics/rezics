import { describe, expect, it } from "vitest";
import { create } from "native-i18n";
import { ContentLanguageValues, UiLocaleValues } from "@rezics/i18n";
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
			"licenses",
			"locale",
			"settings",
		] as const;
		const traditionalChinese = await i18n.getTranslation(namespaces, ["zh-Hant"]);
		const translations = await Promise.all(
			UiLocaleValues.map((locale) => i18n.getTranslation(namespaces, [locale])),
		);

		for (const [index, translation] of translations.entries()) {
			const locale = UiLocaleValues[index];
			expect(translation.locale.current).toBe(locale);
			assertSameTranslationShape(traditionalChinese.t, translation.t, `translation.${locale}`);
			for (const key of UiLocaleValues) expect(translation.t.locale.uiLocales[key]).not.toBe(key);
			for (const key of ContentLanguageValues)
				expect(translation.t.locale.contentLanguages[key]).not.toBe(key);
		}

		const english = translations[UiLocaleValues.indexOf("en")];
		expect(english).toBeDefined();
		if (!english) return;
		expect(
			Object.keys(english.t.errorCodes).every((code) => /^[A-Z][A-Za-z0-9]*$/.test(code)),
		).toBe(true);
		expect(traditionalChinese.locale.current).toBe("zh-Hant");
		expect(traditionalChinese.t.locale.uiLocales["zh-Hant"]).toBe("繁體中文");
		expect(traditionalChinese.t.settings.tokens.standardLimitsDescription).toContain(
			"仍共用帳戶配額",
		);
		expect(
			traditionalChinese.t.settings.tokens.limitRanges({
				requestsMinimum: "1",
				requestsMaximum: "300",
				burstMinimum: "1",
				burstMaximum: "300",
				concurrentMinimum: "1",
				concurrentMaximum: "4",
				dailyMinimum: "1",
				dailyMaximum: "10,000",
			}),
		).toBe(
			"允許範圍：每分鐘要求數 1 至 300；突發容量 1 至 300；同時執行要求數 1 至 4；每日成本單位 1 至 10,000。",
		);
	});
});
