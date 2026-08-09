import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

import { describe, expect, test } from "vitest";

import {
	PRODUCT_DEFINITIONS,
	PRODUCT_IDS,
	isProductId,
	validateProductRegistry,
} from "./content/productRegistry";
import { HOW_MECHANISM_DEFINITIONS, HOW_SCOPE_IDS } from "./content/howMechanisms";
import { CONTACT_LOCALES, getContactCopy, getSiteCopy, isContactLocale } from "./content/locales";
import { PRODUCT_LAYER_IDS, PRODUCT_STAGE_IDS } from "./content/productTypes";
import {
	ABOUT_LOCALES,
	DEFAULT_LOCALE,
	getAboutLocaleFallback,
	getAppEntryUrl,
} from "./i18n/locales";
import {
	getAlternatePaths,
	getContactPath,
	getDocumentationPath,
	getHomePath,
	getHowItWorksPath,
	getLegalPath,
	getProductPath,
	getProductsPath,
	getUsesPath,
} from "./i18n/productPaths";

const localeContentRoot = join(process.cwd(), "src", "content", "locales");

describe("public content contract", () => {
	test("registers exactly 26 valid capabilities with an explicit public stage", () => {
		expect(PRODUCT_DEFINITIONS).toHaveLength(26);
		expect(PRODUCT_IDS).toHaveLength(26);
		expect(validateProductRegistry()).toEqual([]);
		expect(
			PRODUCT_DEFINITIONS.every((product) => PRODUCT_STAGE_IDS.includes(product.stage)),
		).toBe(true);
		for (const stage of PRODUCT_STAGE_IDS) {
			expect(
				PRODUCT_DEFINITIONS.filter((product) => product.stage === stage).length,
			).toBeGreaterThan(0);
		}
	});

	test("keeps every layer populated", () => {
		for (const layer of PRODUCT_LAYER_IDS) {
			expect(
				PRODUCT_DEFINITIONS.filter((product) => product.layer === layer).length,
			).toBeGreaterThan(0);
		}
	});

	test("keeps the default locale complete and validates every available document", async () => {
		for (const locale of ABOUT_LOCALES) {
			const directory = join(localeContentRoot, locale, "products");
			const files = (await readdir(directory)).filter((file) => file.endsWith(".mdx")).sort();

			if (locale === DEFAULT_LOCALE || locale === "zh-hant") {
				expect(files).toEqual(PRODUCT_IDS.map((id) => `${id}.mdx`).sort());
			}
			expect(files.length).toBeGreaterThan(0);
			expect(files.every((file) => isProductId(file.replace(/\.mdx$/, "")))).toBe(true);

			for (const file of files) {
				const source = await readFile(join(directory, file), "utf8");
				const id = file.replace(/\.mdx$/, "");
				const sections = source.split(/^## /m).slice(1);
				expect(source).toContain(`productId: ${id}`);
				expect(source).toContain(`locale: ${locale}`);
				expect(sections.length).toBeGreaterThan(0);
				if (locale === "zh-hant") {
					expect(source).toContain("statusNote:");
					expect(sections.length).toBeGreaterThanOrEqual(4);
				}
				for (const section of sections) {
					const [, ...bodyLines] = section.split("\n");
					expect(bodyLines.join("\n").trim()).not.toBe("");
				}
				expect(source).not.toMatch(/implementationStatus|implementation status/i);
			}
		}
	});

	test("keeps all page copy complete for every locale", () => {
		for (const locale of ABOUT_LOCALES) {
			const copy = getSiteCopy(locale);
			expect(copy.home.principles).toHaveLength(3);
			expect(copy.home.model.steps).toHaveLength(4);
			expect(copy.how.stages).toHaveLength(6);
			expect(copy.uses.journeys).toHaveLength(7);
			expect(Object.keys(copy.products.layers).sort()).toEqual([...PRODUCT_LAYER_IDS].sort());
			if (locale === "zh-hant") {
				expect(copy.home.eyebrow).toBe("傳承 · 創作 · 傳播");
				expect(copy.home.title).toBe("與所愛的故事相遇。");
				expect(copy.home.v1?.focus.label).toBe("第一版現在開始");
				expect(copy.home.v1?.focus.items).toContain("啟動計畫｜首批 40 萬冊");
				expect(copy.how.title).toBe(
					"同一部作品，可以跨平台、跨語言，也可以在不同社群裡被重新理解。",
				);
				expect(HOW_SCOPE_IDS).toEqual(["shared", "realm", "personal"]);
				expect(copy.how.v1?.scope.layers.map(({ title }) => title)).toEqual([
					"共享層",
					"領域作用域",
					"個人層",
				]);
				expect(HOW_MECHANISM_DEFINITIONS.map(({ productId }) => productId)).toEqual([
					"unit",
					"collection",
					"realm",
					"tag",
					"content-structure",
				]);
				expect(copy.how.v1?.mechanisms.items).toHaveLength(
					HOW_MECHANISM_DEFINITIONS.length,
				);
				expect(copy.how.v1?.mechanisms.items[1]?.example.title).toContain("日文書單");
				expect(copy.how.v1?.mechanisms.items[2]?.rule).toContain("不會因內容出現在其中");
				expect(copy.how.v1?.mechanisms.items[3]?.rule).toContain(
					"全域投票不得和領域投票合併",
				);
				expect(copy.how.v1?.mechanisms.items[4]?.title).toContain("Portable Text");
				expect(copy.how.v1?.loop.steps).toHaveLength(5);
				expect(copy.products.stage?.labels).toEqual({
					available: "已可使用",
					development: "開發中",
					planned: "規劃中",
				});
			} else {
				expect(copy.home.v1).toBeUndefined();
				expect(copy.how.v1).toBeUndefined();
				expect(copy.products.stage).toBeUndefined();
			}
		}
	});

	test("registers every available contact translation", () => {
		expect(CONTACT_LOCALES).toEqual(["zh-hant", "en"]);
		expect(getContactCopy("zh-hant").hero.title).toBe("聯繫我們");
		expect(getContactCopy("en").hero.title).toBe("Contact us");
		expect(isContactLocale("zh-hans")).toBe(false);
	});

	test("builds stable public paths and uses the valid app root", () => {
		expect(getAppEntryUrl()).toBe("https://www.rezics.com/");
		expect(getHomePath("en")).toBe("/en/");
		expect(getHowItWorksPath("en")).toBe("/en/how-it-works/");
		expect(getUsesPath("en")).toBe("/en/uses/");
		expect(getProductsPath("en")).toBe("/en/products/");
		expect(getProductPath("en", "unit")).toBe("/en/products/unit/");
		expect(getLegalPath("en", "rezics-unit-content-license-v1")).toBe(
			"/en/legal/rezics-unit-content-license-v1/",
		);
		expect(getDocumentationPath("en", "api/tokens")).toBe("/en/docs/api/tokens/");
		expect(getContactPath("en")).toBe("/en/contact-us/");
		expect(getContactPath("zh-hant")).toBe("/zh-hant/contact-us/");
		expect(getAlternatePaths("contact")).toHaveLength(ABOUT_LOCALES.length);
		expect(getAlternatePaths("product", "unit")).toHaveLength(ABOUT_LOCALES.length);
		expect(getAboutLocaleFallback("zh-hant")).toBe(DEFAULT_LOCALE);
		expect(getAboutLocaleFallback(DEFAULT_LOCALE)).toBeUndefined();
	});
});
