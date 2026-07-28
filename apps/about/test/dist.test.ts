import { access, readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { PRODUCT_DEFINITIONS } from "../src/content/productRegistry";
import { ABOUT_LOCALE_META, ABOUT_LOCALES } from "../src/i18n/locales";

const dist = join(process.cwd(), "dist", "client");
const exists = (path: string) =>
	access(path).then(
		() => true,
		() => false,
	);

describe("Vike prerender output", () => {
	test("contains every localized public route as complete HTML", async () => {
		for (const locale of ABOUT_LOCALES) {
			const paths = [
				join(dist, locale, "index.html"),
				join(dist, locale, "products", "index.html"),
				join(dist, locale, "contact-us", "index.html"),
				...PRODUCT_DEFINITIONS.map((product) =>
					join(dist, locale, "products", product.slug, "index.html"),
				),
			];
			for (const path of paths) {
				const html = await readFile(path, "utf8");
				expect(html).toContain("<!DOCTYPE html>");
				expect(html).toContain("<main");
				expect(html).toContain('rel="canonical"');
				expect(html.toLowerCase()).toContain("hreflang=");
				expect(html).toContain('lang="' + ABOUT_LOCALE_META[locale].htmlLang + '"');
			}
		}
	}, 60_000);

	test("contains SEO, the error page, discovery, and Pages-only assets", async () => {
		const product = await readFile(
			join(dist, "zh-hant", "products", "book", "index.html"),
			"utf8",
		);
		expect(product).toContain("application/ld+json");
		expect(product).toContain('"@type":"WebPage"');
		const notFound = await readFile(join(dist, "404.html"), "utf8");
		expect(notFound).toContain("404");
		expect(notFound).toContain("pages_error");
		expect(await exists(join(dist, "sitemap.xml"))).toBe(true);
		expect(await exists(join(dist, "robots.txt"))).toBe(true);
		expect(await exists(join(dist, "_redirects"))).toBe(false);
		expect(await exists(join(process.cwd(), "dist", "server"))).toBe(false);
	});
});
