import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

import { describe, expect, test } from "vitest";

import {
	PRODUCT_DEFINITIONS,
	PRODUCT_IDS,
	PRODUCT_PRESENTATION_ORDER,
	isProductId,
	validateProductRegistry,
} from "./content/productRegistry";
import { CONTACT_LOCALES, getContactCopy, getSiteCopy, isContactLocale } from "./content/locales";
import { PRODUCT_STAGE_IDS } from "./content/productTypes";
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
	getLegacyHowItWorksPath,
	getLegalPath,
	getProductPath,
	getProductsPath,
	getUsesPath,
} from "./i18n/productPaths";

const localeContentRoot = join(process.cwd(), "src", "content", "locales");

describe("public content contract", () => {
	test("registers exactly 26 valid products with an explicit stage and editorial order", () => {
		expect(PRODUCT_DEFINITIONS).toHaveLength(26);
		expect(PRODUCT_IDS).toHaveLength(26);
		expect(PRODUCT_PRESENTATION_ORDER).toHaveLength(PRODUCT_IDS.length);
		expect(PRODUCT_PRESENTATION_ORDER.slice(0, 4)).toEqual(["collection", "tag", "wiki", "realm"]);
		expect([...PRODUCT_PRESENTATION_ORDER].sort()).toEqual([...PRODUCT_IDS].sort());
		expect(validateProductRegistry()).toEqual([]);
		expect(PRODUCT_DEFINITIONS.every((product) => PRODUCT_STAGE_IDS.includes(product.stage))).toBe(
			true,
		);
		for (const stage of PRODUCT_STAGE_IDS) {
			expect(
				PRODUCT_DEFINITIONS.filter((product) => product.stage === stage).length,
			).toBeGreaterThan(0);
		}
	});

	test("keeps every locale complete and validates every available document", async () => {
		const zhHantDocumentStructure = new Map(
			await Promise.all(
				PRODUCT_IDS.map(async (id) => {
					const source = await readFile(
						join(localeContentRoot, "zh-hant", "products", `${id}.mdx`),
						"utf8",
					);
					return [
						id,
						{
							sectionCount: source.split(/^## /m).length - 1,
							numberedItemCount: source.match(/^1\. /gm)?.length ?? 0,
							codeFenceCount: source.match(/^```/gm)?.length ?? 0,
						},
					] as const;
				}),
			),
		);

		for (const locale of ABOUT_LOCALES) {
			const directory = join(localeContentRoot, locale, "products");
			const files = (await readdir(directory)).filter((file) => file.endsWith(".mdx")).sort();

			expect(files).toEqual(PRODUCT_IDS.map((id) => `${id}.mdx`).sort());
			expect(files.every((file) => isProductId(file.replace(/\.mdx$/, "")))).toBe(true);

			for (const file of files) {
				const source = await readFile(join(directory, file), "utf8");
				const id = file.replace(/\.mdx$/, "");
				if (!isProductId(id)) {
					throw new Error(`Unexpected product document: ${file}`);
				}
				const expectedStructure = zhHantDocumentStructure.get(id);
				if (expectedStructure === undefined) {
					throw new Error(`Missing zh-Hant document structure for product: ${id}`);
				}
				const sections = source.split(/^## /m).slice(1);
				expect(source).toContain(`productId: ${id}`);
				expect(source).toContain(`locale: ${locale}`);
				expect(sections).toHaveLength(expectedStructure.sectionCount);
				expect(source.match(/^1\. /gm)?.length ?? 0).toBe(expectedStructure.numberedItemCount);
				expect(source.match(/^```/gm)?.length ?? 0).toBe(expectedStructure.codeFenceCount);
				expect(source).toContain("statusNote:");
				expect(sections.length).toBeGreaterThanOrEqual(4);
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
			expect(copy.home.v1.identity.sources).toHaveLength(3);
			expect(copy.home.v1.loop.steps).toHaveLength(5);
			expect(copy.home.v1.foundation.pillars).toHaveLength(4);
			expect(copy.uses.journeys).toHaveLength(7);
			for (const stage of PRODUCT_STAGE_IDS) {
				expect(copy.products.stage.labels[stage]).toEqual(expect.any(String));
			}
			if (locale === "zh-hant") {
				expect(copy.home.eyebrow).toBe("傳承 · 創作 · 傳播");
				expect(copy.home.title).toBe("與所愛的故事相遇。");
				expect(copy.nav.products).toBe("產品");
				expect(copy.products.title).toBe("讓作品被找到、理解、收藏，也被共同延續。");
				expect(copy.products.lead).toContain("標籤與社群分類");
				expect(copy.products.stage.labels).toEqual({
					available: "已可使用",
					development: "開發中",
					planned: "規劃中",
				});
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
		expect(getLegacyHowItWorksPath("en")).toBe("/en/how-it-works/");
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
