import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";

import { onRequest as languageMiddleware } from "../functions/_middleware";
import { GlobalFooter } from "./components/products/GlobalFooter";
import { GlobalHeader } from "./components/products/GlobalHeader";
import { HomeExperience } from "./components/products/HomeExperience";
import { getLocaleContent } from "./content/locales";
import {
	PRODUCT_DEFINITIONS,
	PRODUCT_FAMILIES,
	getParentProduct,
	getRelatedProducts,
	type ProductId,
} from "./content/productRegistry";
import type { ProductDefinition } from "./content/productTypes";
import {
	ABOUT_LOCALES,
	ABOUT_SITE_ORIGIN,
	matchAboutLocale,
	negotiateAboutLocale,
} from "./i18n/locales";
import {
	getAlternatePaths,
	getCanonicalForPath,
	getContactPath,
	getHomePath,
	getProductPath,
	getProductsPath,
} from "./i18n/productPaths";
import { createSitemapXml } from "./sitemap";

const appRoot = join(fileURLToPath(new URL(".", import.meta.url)), "..");

describe("zh-Hant publication boundary", () => {
	test("publishes Traditional Chinese only", async () => {
		expect(ABOUT_LOCALES).toEqual(["zh-hant"]);
		expect(matchAboutLocale("zh-TW")).toBe("zh-hant");
		expect(matchAboutLocale("zh-Hant-HK")).toBe("zh-hant");
		expect(matchAboutLocale("en-US")).toBeUndefined();
		expect(negotiateAboutLocale()).toBe("zh-hant");

		const localeEntries = await readdir(join(appRoot, "src", "content", "locales"), {
			withFileTypes: true,
		});
		expect(
			localeEntries.filter((entry) => entry.isDirectory()).map((entry) => entry.name),
		).toEqual(["zh-hant"]);
	});

	test("keeps every visible product string in the zh-Hant owner", () => {
		const content = getLocaleContent("zh-hant");
		const productIds: ProductId[] = PRODUCT_DEFINITIONS.map((product) => product.id);
		const sortedProductIds = [...productIds].sort();

		expect(content.home.meta.title).toBe("REZICS: 與所愛的故事相遇");
		expect(Object.keys(content.products.common.names).sort()).toEqual(sortedProductIds);
		expect(Object.keys(content.products.byId).sort()).toEqual(sortedProductIds);

		for (const productId of productIds) {
			const page = content.products.byId[productId];
			expect(content.products.common.names[productId].trim().length).toBeGreaterThan(0);
			expect(page.summary.trim().length).toBeGreaterThan(0);
			expect(page.introduction.trim().length).toBeGreaterThan(0);
			expect(page.uses).toHaveLength(3);
			expect(page.operation).toHaveLength(3);
			expect(page.boundary.trim().length).toBeGreaterThan(0);
		}
	});
});

describe("guided product registry", () => {
	test("publishes 26 unique products in four intentional paths", () => {
		expect(PRODUCT_DEFINITIONS).toHaveLength(26);
		expect(new Set(PRODUCT_DEFINITIONS.map((product) => product.id)).size).toBe(26);
		expect(new Set(PRODUCT_DEFINITIONS.map((product) => product.slug)).size).toBe(26);
		expect(PRODUCT_FAMILIES.discover).toHaveLength(9);
		expect(PRODUCT_FAMILIES.create).toHaveLength(8);
		expect(PRODUCT_FAMILIES.continue).toHaveLength(6);
		expect(PRODUCT_FAMILIES.open).toHaveLength(3);
	});

	test("keeps parents and related products inside the registry", () => {
		const products: readonly ProductDefinition[] = PRODUCT_DEFINITIONS;
		const registeredIds = new Set(products.map((product) => product.id));

		for (const product of products) {
			for (const relatedId of product.relatedProductIds) {
				expect(registeredIds.has(relatedId), `${product.id} -> ${relatedId}`).toBe(true);
			}
			if (product.canonicalParentId) {
				expect(getParentProduct(product)?.id).toBe(product.canonicalParentId);
			}
			expect(getRelatedProducts(product)).toHaveLength(product.relatedProductIds.length);
		}
	});

	test("uses demos only where the interaction explains the product", () => {
		const products: readonly ProductDefinition[] = PRODUCT_DEFINITIONS;
		expect(products.filter((product) => product.demoKind).map((product) => product.id)).toEqual(
			["gamebook", "content-structure", "history"],
		);
	});
});

describe("brand site shell", () => {
	test("keeps the brand and utilities around the centered primary navigation", () => {
		const copy = getLocaleContent("zh-hant").common;
		const html = renderToStaticMarkup(
			<GlobalHeader
				locale="zh-hant"
				copy={copy}
				active="home"
				alternatePathByLocale={{ "zh-hant": "/zh-hant/" }}
			/>,
		);

		expect(html).toContain(">首頁<");
		expect(html).toContain(">產品<");
		expect(html).toContain("<img");
		expect(html).toContain('href="https://github.com/rezics"');
		expect(html).toContain('class="language-switcher"');
		expect(html).toContain('aria-label="切換明暗主題"');
		expect(html.match(/<nav/g) ?? []).toHaveLength(2);
	});

	test("locks the one-line hero into the shared brand theme", async () => {
		const css = (
			await readFile(join(appRoot, "src", "styles", "site.css"), "utf8")
		).toLowerCase();

		expect(css).toContain(".home-hero h1");
		expect(css).toContain("white-space: nowrap");
		expect(css).toContain("--primary: var(--colors-brand-fill)");
		expect(css).toContain(".dark");
		expect(css).toContain("background: var(--background)");
	});

	test("keeps the full footer information architecture and routes home contact correctly", () => {
		const footer = renderToStaticMarkup(<GlobalFooter locale="zh-hant" />);
		const home = renderToStaticMarkup(<HomeExperience locale="zh-hant" />);

		expect(footer).toContain("<img");
		expect(footer).toContain('id="footer-products"');
		expect(footer).toContain('id="footer-platform"');
		expect(footer).toContain('id="footer-open"');
		expect(footer).toContain('href="/zh-hant/contact-us/"');
		expect(footer).toContain("AGPL-3.0");
		expect(home).toContain('href="/zh-hant/contact-us/"');
		expect(home).not.toContain("mailto:");
	});
});

describe("routes and discovery", () => {
	test("builds one canonical locale without translation alternates", () => {
		expect(getHomePath("zh-hant")).toBe("/zh-hant/");
		expect(getProductsPath("zh-hant")).toBe("/zh-hant/products/");
		expect(getContactPath("zh-hant")).toBe("/zh-hant/contact-us/");
		expect(getProductPath("zh-hant", "book")).toBe("/zh-hant/products/book/");
		expect(getCanonicalForPath("/zh-hant/products/book/")).toBe(
			`${ABOUT_SITE_ORIGIN}/zh-hant/products/book/`,
		);
		expect(getAlternatePaths("product", "history")).toEqual({
			"zh-hant": "/zh-hant/products/history/",
		});
		expect(getAlternatePaths("contact")).toEqual({
			"zh-hant": "/zh-hant/contact-us/",
		});
	});

	test("lists the home, contact page, directory, and every product page", () => {
		const sitemap = createSitemapXml();
		expect(sitemap.match(/<url>/g)).toHaveLength(PRODUCT_DEFINITIONS.length + 3);
		expect(sitemap).toContain("<loc>https://about.rezics.com/zh-hant/products/gamebook/</loc>");
		expect(sitemap).toContain("<loc>https://about.rezics.com/zh-hant/contact-us/</loc>");
		expect(sitemap).not.toContain("/en/");
	});

	test("redirects unlocalized public entries to zh-Hant", async () => {
		const next = () =>
			new Response(null, {
				status: 204,
				headers: { "x-next": "true" },
			});

		for (const [source, target] of [
			["/", "/zh-hant/"],
			["/products/", "/zh-hant/products/"],
			["/contact-us/", "/zh-hant/contact-us/"],
			["/products/book/", "/zh-hant/products/book/"],
		] as const) {
			const response = await languageMiddleware({
				request: new Request(`https://about.rezics.com${source}`),
				next,
			});
			expect(response.status, source).toBe(302);
			expect(response.headers.get("location"), source).toBe(
				`https://about.rezics.com${target}`,
			);
		}

		const localized = await languageMiddleware({
			request: new Request("https://about.rezics.com/zh-hant/products/history/"),
			next,
		});
		expect(localized.status).toBe(204);
		expect(localized.headers.get("x-next")).toBe("true");
	});
});
