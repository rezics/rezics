import { access, readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import {
	PRODUCT_CLAIMS,
	PRODUCT_DEFINITIONS,
	PRODUCT_GROUPS,
	PRODUCT_MEDIA,
	PROTOCOL_DEFINITIONS,
	getProductById,
	type ProductId,
} from "./content/productRegistry";
import type { ProductDefinition } from "./content/productTypes";
import { getLocalizedProductCopy } from "./content/productCopy";
import { getProductPageFacts } from "./content/productPageFacts";
import { getInterfaceCopy } from "./content/interfaceCopy";
import {
	ABOUT_LOCALES,
	ABOUT_SITE_ORIGIN,
	matchAboutLocale,
	negotiateAboutLocale,
} from "./i18n/locales";
import {
	getAlternatePaths,
	getCanonicalForPath,
	getHomePath,
	getProductPath,
	getProductsPath,
} from "./i18n/productPaths";
import { onRequest as languageMiddleware } from "../functions/_middleware";
import { createSitemapXml } from "./sitemap";

const workspaceRoot = join(fileURLToPath(new URL(".", import.meta.url)), "..");

function requireProduct(id: string): ProductDefinition {
	const product = getProductById(id);
	if (!product) throw new Error(`Missing product definition: ${id}`);
	return product;
}

describe("locale handling", () => {
	test("keeps the six public locales stable", () => {
		expect(ABOUT_LOCALES).toEqual(["zh-hant", "zh-hans", "en", "ja", "de", "ko"]);
	});

	test("matches regional language tags and weighted preferences", () => {
		expect(matchAboutLocale("zh-TW")).toBe("zh-hant");
		expect(matchAboutLocale("zh-CN")).toBe("zh-hans");
		expect(matchAboutLocale("de-DE")).toBe("de");
		expect(matchAboutLocale("fr-FR")).toBeUndefined();
		expect(negotiateAboutLocale("en;q=0.7, ja-JP;q=0.9")).toBe("ja");
		expect(negotiateAboutLocale(null)).toBe("zh-hant");
	});
});

describe("product fact registry", () => {
	test("publishes 25 unique non-protocol product pages", () => {
		expect(PRODUCT_DEFINITIONS).toHaveLength(25);
		expect(new Set(PRODUCT_DEFINITIONS.map(({ id }) => id)).size).toBe(25);
		expect(new Set(PRODUCT_DEFINITIONS.map(({ slug }) => slug)).size).toBe(25);
		expect(PRODUCT_DEFINITIONS.map(({ pageClass }) => String(pageClass))).not.toContain(
			"protocol",
		);
		expect(PRODUCT_GROUPS.products).toHaveLength(17);
		expect(PRODUCT_GROUPS.platform).toHaveLength(8);
	});

	test("encodes manifestations and shared capabilities without changing parentage", () => {
		const gamebook = requireProduct("gamebook");
		const structure = requireProduct("content-structure");
		const history = requireProduct("history");
		const entity = requireProduct("entity-attribution");

		expect(gamebook.pageClass).toBe("manifestation");
		expect(gamebook.canonicalParentId).toBe("book");
		expect(gamebook.manifestation?.formula).toBe("Book + GameContentStructure → GameBook");

		expect(structure.pageClass).toBe("capability");
		expect(structure.canonicalParentId).toBeUndefined();
		expect(structure.capabilityModes).toEqual(["ContentStructure", "GameContentStructure"]);
		expect(gamebook.canonicalParentId).not.toBe(structure.id);

		for (const id of ["wiki", "picture", "review"]) {
			expect(requireProduct(id).canonicalParentId).toBe("post");
		}
		expect(requireProduct("library").canonicalParentId).toBe("shelf");

		expect(history.canonicalParentId).toBeUndefined();
		expect(history.consumesCapabilities).not.toContain("editor");

		expect(entity.canonicalParentId).toBeUndefined();
		expect(entity.implementationStatus).toBe("implemented");
		expect(entity.capabilityModes).toEqual([
			"Entity",
			"CreditAttribution",
			"SubjectAttribution",
		]);
	});

	test("has no parent cycles or protocol pages", () => {
		for (const definition of PRODUCT_DEFINITIONS) {
			const visited = new Set<string>();
			let product: ProductDefinition | undefined = definition;

			while (product) {
				expect(visited.has(product.id)).toBe(false);
				visited.add(product.id);
				if (!product.canonicalParentId) break;
				product = getProductById(product.canonicalParentId);
				expect(product).toBeDefined();
			}
		}

		expect(PROTOCOL_DEFINITIONS.map(({ name }) => name)).toEqual([
			"Unit",
			"Block Schema",
			"Zone Atom",
			"Cover",
			"Poll",
			"Issue",
			"Chapter",
		]);
		for (const protocol of PROTOCOL_DEFINITIONS) {
			expect(PRODUCT_DEFINITIONS.some(({ id }) => id === protocol.id)).toBe(false);
		}
	});
});

describe("confirmed product claims", () => {
	test("tracks the Entity and Attribution implementation truth", () => {
		const claimStatus = Object.fromEntries(
			PRODUCT_CLAIMS.map((claim) => [claim.id, claim.status]),
		);

		expect(claimStatus["entity-implemented"]).toBe("confirmed");
		expect(claimStatus["credit-attribution"]).toBe("confirmed");
		expect(claimStatus["subject-attribution"]).toBe("confirmed");
		expect(claimStatus["source-provenance-future"]).toBe("planned");

		const entity = requireProduct("entity-attribution");
		const copy = getLocalizedProductCopy("zh-hant", entity.id as ProductId);
		const facts = getProductPageFacts("zh-hant", entity, copy);
		const publicText = [
			copy.summary,
			...facts.scenarios,
			...facts.workflow,
			...facts.boundaries,
		].join(" ");

		for (const fact of [
			"Entity",
			"CreditAttribution",
			"SubjectAttribution",
			"作者",
			"譯者",
			"出版商",
			"角色",
			"主角",
			"二創",
			"Unit",
			"Tag",
			"Source / Provenance",
		]) {
			expect(publicText).toContain(fact);
		}
	});

	test("keeps Content Structure and History boundaries explicit", () => {
		const structure = requireProduct("content-structure");
		const structureCopy = getLocalizedProductCopy("en", structure.id as ProductId);
		const structureText = Object.values(getProductPageFacts("en", structure, structureCopy))
			.flat()
			.join(" ");

		expect(structureText).toContain("ordered tree");
		expect(structureText).toContain("occurrence");
		expect(structureText).toContain("Node is not the same thing as a Post");
		expect(structureText).toContain("Book integration");
		expect(structureText).toContain("not GameBook’s parent");

		const history = requireProduct("history");
		const historyCopy = getLocalizedProductCopy("en", history.id as ProductId);
		const historyFacts = getProductPageFacts("en", history, historyCopy);
		const historyText = Object.values(historyFacts).flat().join(" ");

		expect(historyText).toContain("published versions");
		expect(historyText).toContain("lock state and scope");
		expect(historyText).toContain("draft operations");
		expect(historyText).toContain("not part of Editor");
		expect(historyText).toContain("automatic merge");
		expect(historyText).toContain("arbitrary restore");
	});
});

describe("complete localized content and media", () => {
	test("has explicit non-English copy for every product", () => {
		for (const product of PRODUCT_DEFINITIONS) {
			const english = getLocalizedProductCopy("en", product.id).summary;
			expect(english.trim().length).toBeGreaterThan(0);

			for (const locale of ABOUT_LOCALES) {
				const localized = getLocalizedProductCopy(locale, product.id);
				expect(localized.summary.trim().length).toBeGreaterThan(0);
				expect(localized.faq).toHaveLength(2);
				if (locale !== "en") {
					expect(localized.summary).not.toBe(english);
				}
			}
		}
	});

	test("has explicit localized homepage and accessibility interface copy", () => {
		const english = JSON.stringify(getInterfaceCopy("en"));

		for (const locale of ABOUT_LOCALES) {
			const localized = getInterfaceCopy(locale);
			expect(localized.home.historyConsumers.book.trim().length).toBeGreaterThan(0);
			expect(localized.home.openDescriptions.github.trim().length).toBeGreaterThan(0);
			expect(localized.a11y.skipContent.trim().length).toBeGreaterThan(0);
			expect(localized.a11y.primaryNavigation.trim().length).toBeGreaterThan(0);
			if (locale !== "en") {
				expect(JSON.stringify(localized)).not.toBe(english);
			}
		}
	});

	test("gives every product a replaceable fixed-ratio concept stage", () => {
		expect(PRODUCT_MEDIA).toHaveLength(PRODUCT_DEFINITIONS.length);
		for (const media of PRODUCT_MEDIA) {
			expect(media.kind).toBe("concept-component");
			expect(media.fidelity).toBe("concept");
			expect(media.replaceable).toBe(true);
			expect(media.width).toBeGreaterThan(0);
			expect(media.height).toBeGreaterThan(0);
			expect(media.themes).toEqual(["light", "dark"]);
			expect(media.viewports).toEqual(["desktop", "mobile"]);
			expect(requireProduct(media.productId).mediaIds).toContain(media.id);
		}
	});
});

describe("public routes, redirects, and discovery", () => {
	test("builds canonical and alternate plural routes", () => {
		expect(getHomePath("zh-hant")).toBe("/zh-hant/");
		expect(getProductsPath("de")).toBe("/de/products/");
		expect(getProductPath("ko", "book")).toBe("/ko/products/book/");
		expect(getCanonicalForPath("/en/products/book/")).toBe(
			`${ABOUT_SITE_ORIGIN}/en/products/book/`,
		);

		const alternates = getAlternatePaths("product", "history");
		expect(Object.keys(alternates)).toHaveLength(ABOUT_LOCALES.length);
		expect(alternates.ja).toBe("/ja/products/history/");
		expect(alternates["zh-hans"]).toBe("/zh-hans/products/history/");
	});

	test("lists home, directory, and all product pages for every locale", async () => {
		const sitemap = createSitemapXml();
		const urls = sitemap.match(/<url>/g) ?? [];

		expect(urls).toHaveLength(ABOUT_LOCALES.length * (PRODUCT_DEFINITIONS.length + 2));
		expect(sitemap).toContain("<loc>https://about.rezics.com/zh-hant/products/gamebook/</loc>");
		expect(sitemap).toContain(
			"<loc>https://about.rezics.com/de/products/entity-attribution/</loc>",
		);
	});

	test("negotiates neutral legacy and plural entry paths", async () => {
		const next = () =>
			new Response(null, {
				status: 204,
				headers: { "x-next": "true" },
			});

		const indexRedirect = await languageMiddleware({
			request: new Request("https://about.rezics.com/product/?ref=nav", {
				headers: { "accept-language": "ja-JP" },
			}),
			next,
		});
		expect(indexRedirect.status).toBe(302);
		expect(indexRedirect.headers.get("location")).toBe(
			"https://about.rezics.com/ja/products/?ref=nav",
		);

		const detailRedirect = await languageMiddleware({
			request: new Request("https://about.rezics.com/product/gamebook/", {
				headers: { "accept-language": "de-DE" },
			}),
			next,
		});
		expect(detailRedirect.headers.get("location")).toBe(
			"https://about.rezics.com/de/products/gamebook/",
		);

		const renamedRedirect = await languageMiddleware({
			request: new Request("https://about.rezics.com/products/entity-source/?from=old", {
				headers: { "accept-language": "zh-CN" },
			}),
			next,
		});
		expect(renamedRedirect.headers.get("location")).toBe(
			"https://about.rezics.com/zh-hans/products/entity-attribution/?from=old",
		);

		const permanentRedirect = await languageMiddleware({
			request: new Request("https://about.rezics.com/ja/product/gamebook/?from=old"),
			next,
		});
		expect(permanentRedirect.status).toBe(301);
		expect(permanentRedirect.headers.get("location")).toBe(
			"https://about.rezics.com/ja/products/gamebook/?from=old",
		);
		expect(permanentRedirect.headers.get("cache-control")).toContain("public");

		const localizedRenamedRedirect = await languageMiddleware({
			request: new Request("https://about.rezics.com/de/products/entity-source/"),
			next,
		});
		expect(localizedRenamedRedirect.status).toBe(301);
		expect(localizedRenamedRedirect.headers.get("location")).toBe(
			"https://about.rezics.com/de/products/entity-attribution/",
		);

		const redirects = await readFile(join(workspaceRoot, "public", "_redirects"), "utf8");
		expect(redirects).toContain("/:locale/product/:slug/ /:locale/products/:slug/ 301");
		expect(redirects.indexOf("product/entity-source")).toBeLessThan(
			redirects.indexOf("product/:slug"),
		);

		const localized = await languageMiddleware({
			request: new Request("https://about.rezics.com/en/products/history/", {
				headers: { "accept-language": "ja" },
			}),
			next,
		});
		expect(localized.status).toBe(204);
		expect(localized.headers.get("x-next")).toBe("true");
	});
});

describe("design constraints", () => {
	test("retains the locked Rezics palette", async () => {
		const css = (
			await readFile(join(workspaceRoot, "src", "styles", "site.css"), "utf8")
		).toLowerCase();
		const logo = (
			await readFile(join(workspaceRoot, "public", "logo.svg"), "utf8")
		).toLowerCase();

		for (const color of [
			"#ffffff",
			"#000000",
			"#f5f5f5",
			"#0b0b0b",
			"#202020",
			"#111111",
			"#5f6368",
			"#b6b6b6",
			"#d9d9d9",
			"#3a3a3a",
			"#ef4444",
			"#dc2626",
		]) {
			expect(css).toContain(color);
		}
		expect(logo).toContain("#db515c");
	});

	test("removes the obsolete abstract graph implementation", async () => {
		const packageJson = await readFile(join(workspaceRoot, "package.json"), "utf8");
		const graphPath = join(workspaceRoot, "src", "components", "rezicsArchitectureGraph.ts");
		const graphExists = await access(graphPath).then(
			() => true,
			() => false,
		);

		expect(packageJson).not.toContain("@viz-js/viz");
		expect(graphExists).toBe(false);
	});
});
