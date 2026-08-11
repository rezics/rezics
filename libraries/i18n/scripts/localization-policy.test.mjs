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

function checkTypeScript(source, path = "libraries/i18n/src/languages/zh-Hant/example.ts") {
	return checkTypeScriptSource({
		path,
		source,
		verbatimDefinitions,
		terminologyDefinitions,
		rejectUnapprovedTokens: true,
	});
}

describe("localization terminology policy", () => {
	it("maps core, fixture, and about paths to canonical locale tags", () => {
		expect(localeForLocalizationPath("/repo/libraries/i18n/src/languages/zh-Hant/example.ts")).toBe(
			"zh-Hant",
		);
		expect(
			localeForLocalizationPath("/repo/libraries/fixture-data/src/languages/en/content-feed.ts"),
		).toBe("en");
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

	it("allows only approved autonyms in the uiLocales map", () => {
		const approved = checkTypeScript(
			'export default { uiLocales: { en: "English", de: "Deutsch", fr: "Français", es: "Español" } };',
			"libraries/i18n/src/languages/ja/locale.ts",
		);
		const wrongProperty = checkTypeScript(
			'export default { contentLanguages: { en: "English" } };',
			"libraries/i18n/src/languages/ja/locale.ts",
		);
		const unapprovedValue = checkTypeScript(
			'export default { uiLocales: { en: "English language" } };',
			"libraries/i18n/src/languages/ja/locale.ts",
		);

		expect(approved).toEqual([]);
		expect(wrongProperty).toEqual([
			expect.stringContaining('unapproved untranslated token "English"'),
		]);
		expect(unapprovedValue).toEqual(
			expect.arrayContaining([
				expect.stringContaining('unapproved untranslated token "English"'),
				expect.stringContaining('unapproved untranslated token "language"'),
			]),
		);
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
			source: "技術識別法為 `Zone`，套件為 `@rezics/api`。",
			verbatimDefinitions,
			terminologyDefinitions,
			rejectUnapprovedTokens: true,
		});

		expect(errors).toEqual([]);
	});

	it("still enforces canonical spelling in visible Markdown prose", () => {
		const errors = checkMarkdownSource({
			path: "apps/about/src/content/locales/en/example.md",
			source: "Connect to Rezics.",
			verbatimDefinitions,
			terminologyDefinitions,
			rejectUnapprovedTokens: false,
		});

		expect(errors).toEqual([
			expect.stringContaining('use canonical spelling "REZICS" instead of "Rezics"'),
		]);
	});

	it("allows internal field terminology in about developer and legal references", () => {
		const docsErrors = checkMarkdownSource({
			path: "apps/about/src/content/locales/en/docs/api/example.mdx",
			source: "Use the Unit slug returned by the API.",
			verbatimDefinitions,
			terminologyDefinitions: flattenTerminology({
				unitSlug: {
					forms: { label: "Path identifier" },
					forbidden: ["slug"],
				},
			}),
			rejectUnapprovedTokens: false,
		});
		const productErrors = checkMarkdownSource({
			path: "apps/about/src/content/locales/en/products/example.mdx",
			source: "Use the Unit slug returned by the API.",
			verbatimDefinitions,
			terminologyDefinitions: flattenTerminology({
				unitSlug: {
					forms: { label: "Path identifier" },
					forbidden: ["slug"],
				},
			}),
			rejectUnapprovedTokens: false,
		});

		expect(docsErrors).toEqual([]);
		expect(productErrors).toEqual([
			expect.stringContaining('forbidden unitSlug terminology "slug"'),
		]);
	});

	it("checks MDX metadata prose without treating module syntax as visible copy", () => {
		const approved = checkMarkdownSource({
			path: "apps/about/src/content/locales/zh-hant/products/example.mdx",
			source: `export const metadata = {
	name: "專區",
	summary: "歡迎來到專區。",
};

## 詳細內容`,
			verbatimDefinitions,
			terminologyDefinitions,
			rejectUnapprovedTokens: true,
		});
		const forbidden = checkMarkdownSource({
			path: "apps/about/src/content/locales/zh-hant/products/example.mdx",
			source: `export const metadata = { name: "Zone" };

## 詳細內容`,
			verbatimDefinitions,
			terminologyDefinitions,
			rejectUnapprovedTokens: true,
		});

		expect(approved).toEqual([]);
		expect(forbidden).toEqual(
			expect.arrayContaining([expect.stringContaining('forbidden zone terminology "Zone"')]),
		);
	});

	it("checks visible YAML frontmatter without treating identifiers as prose", () => {
		const errors = checkMarkdownSource({
			path: "apps/about/src/content/locales/zh-hant/products/example.mdx",
			source: `---
productId: zone
locale: zh-hant
title: "專區"
summary: "歡迎來到專區。"
description: "技術識別法位於程式碼中。"
---

## 詳細內容`,
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
