import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

import { describe, expect, test } from "vitest";

import {
	PRODUCT_DEFINITIONS,
	PRODUCT_IDS,
	isProductId,
	validateProductRegistry,
} from "./content/productRegistry";
import { CONTACT_LOCALES, getContactCopy, getSiteCopy, isContactLocale } from "./content/locales";
import { PRODUCT_LAYER_IDS } from "./content/productTypes";
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
	test("registers exactly 26 valid capabilities without maturity fields", () => {
		expect(PRODUCT_DEFINITIONS).toHaveLength(26);
		expect(PRODUCT_IDS).toHaveLength(26);
		expect(validateProductRegistry()).toEqual([]);
		expect(
			PRODUCT_DEFINITIONS.some((product) => Object.hasOwn(product, "implementationStatus")),
		).toBe(false);
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

			if (locale === DEFAULT_LOCALE) {
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
				for (const section of sections) {
					const [, ...bodyLines] = section.split("\n");
					expect(bodyLines.join("\n").trim()).not.toBe("");
				}
				expect(source).not.toMatch(
					/implementationStatus|implementation status|implemented|planned|research/i,
				);
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
			expect(JSON.stringify(copy)).not.toMatch(/implementationStatus|"planned"|"research"/i);
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
