import { describe, expect, it } from "vitest";

import {
	checkMarkdownSource,
	checkTerminologyRegistry,
	checkTypeScriptSource,
	flattenTerminology,
	localeForLocalizationPath,
} from "./localization-policy.mjs";

const terminology = {
	zone: {
		status: "approved",
		forms: { label: "專區", inline: "專區" },
		forbidden: ["Zone"],
	},
};
const terminologyDefinitions = flattenTerminology(terminology);
const verbatimDefinitions = [{ key: "rezics", value: "REZICS" }];

function checkTypeScript(source) {
	return checkTypeScriptSource({
		path: "libraries/i18n/src/languages/zh-Hant/example.ts",
		source,
		verbatimDefinitions,
		terminologyDefinitions,
		rejectUnapprovedTokens: true,
	});
}

describe("localization terminology policy", () => {
	it("maps core and about paths to canonical locale tags", () => {
		expect(
			localeForLocalizationPath("/repo/libraries/i18n/src/languages/zh-Hant/example.ts"),
		).toBe("zh-Hant");
		expect(
			localeForLocalizationPath("/repo/apps/about/src/content/locales/zh-hans/example.ts"),
		).toBe("zh-Hans");
	});

	it("requires TypeScript resources to reference approved terminology", () => {
		const errors = checkTypeScript('export default { title: "專區" };');

		expect(errors).toHaveLength(1);
		expect(errors[0]).toContain("use terminology.zone.forms.label");
	});

	it("accepts a typed terminology reference", () => {
		const errors = checkTypeScript(
			'import { zhHantTerminology } from "@rezics/i18n/terminology/zh-Hant"; export default { title: zhHantTerminology.zone.forms.label };',
		);

		expect(errors).toEqual([]);
	});

	it("rejects forbidden alternatives", () => {
		const errors = checkTypeScript('export default { title: "Zone" };');

		expect(errors).toHaveLength(2);
		expect(errors).toEqual(
			expect.arrayContaining([
				expect.stringContaining('forbidden zone terminology "Zone"'),
				expect.stringContaining('unapproved untranslated token "Zone"'),
			]),
		);
	});

	it("allows approved terminology literals in Markdown but rejects alternatives", () => {
		const approved = checkMarkdownSource({
			path: "apps/about/src/content/locales/zh-hant/example.md",
			source: "歡迎來到專區。",
			verbatimDefinitions,
			terminologyDefinitions,
			rejectUnapprovedTokens: true,
		});
		const forbidden = checkMarkdownSource({
			path: "apps/about/src/content/locales/zh-hant/example.md",
			source: "歡迎來到 Zone。",
			verbatimDefinitions,
			terminologyDefinitions,
			rejectUnapprovedTokens: true,
		});

		expect(approved).toEqual([]);
		expect(forbidden).toEqual(
			expect.arrayContaining([expect.stringContaining('forbidden zone terminology "Zone"')]),
		);
	});

	it("ignores technical identifiers in Markdown code", () => {
		const errors = checkMarkdownSource({
			path: "apps/about/src/content/locales/zh-hant/example.md",
			source: "技術識別法為 `Zone`。",
			verbatimDefinitions,
			terminologyDefinitions,
			rejectUnapprovedTokens: true,
		});

		expect(errors).toEqual([]);
	});

	it("rejects empty and self-forbidden registry values", () => {
		const errors = checkTerminologyRegistry({
			"zh-Hant": {
				zone: {
					forms: { label: "專區", inline: "" },
					forbidden: ["專區", ""],
				},
			},
		});

		expect(errors).toHaveLength(3);
		expect(errors).toEqual(
			expect.arrayContaining([
				expect.stringContaining("forms.inline must not be empty"),
				expect.stringContaining("forbidden duplicates approved form"),
				expect.stringContaining("forbidden must not contain an empty value"),
			]),
		);
	});
});
