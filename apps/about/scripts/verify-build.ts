import { access, readdir, readFile } from "node:fs/promises";
import { join, relative, sep } from "node:path";

import { PRODUCT_IDS, getProductById, isProductId } from "../src/content/productRegistry";
import {
	ABOUT_LOCALES,
	ABOUT_LOCALE_META,
	ABOUT_SITE_ORIGIN,
	DEFAULT_LOCALE,
} from "../src/i18n/locales";
import {
	getContactPath,
	getDocumentationPath,
	getHomePath,
	getHowItWorksPath,
	getLegalPath,
	getProductPath,
	getProductsPath,
	getUsesPath,
} from "../src/i18n/productPaths";

const distRoot = join(process.cwd(), "dist");
const localeContentRoot = join(process.cwd(), "src", "content", "locales");

function outputPath(publicPath: string): string {
	return join(distRoot, publicPath.replace(/^\/|\/$/g, ""), "index.html");
}

async function readOutput(publicPath: string): Promise<string> {
	try {
		return await readFile(outputPath(publicPath), "utf8");
	} catch (error) {
		throw new Error(`Missing build output for ${publicPath}`, { cause: error });
	}
}

async function outputExists(publicPath: string): Promise<boolean> {
	try {
		await access(outputPath(publicPath));
		return true;
	} catch {
		return false;
	}
}

async function findMdxFiles(directory: string): Promise<readonly string[]> {
	try {
		const entries = await readdir(directory, { withFileTypes: true });
		const files = await Promise.all(
			entries.map(async (entry) => {
				const entryPath = join(directory, entry.name);
				if (entry.isDirectory()) return findMdxFiles(entryPath);
				return entry.isFile() && entry.name.endsWith(".mdx") ? [entryPath] : [];
			}),
		);
		return files.flat();
	} catch {
		return [];
	}
}

const productIdsByLocale = new Map(
	await Promise.all(
		ABOUT_LOCALES.map(async (locale) => {
			const files = await readdir(join(localeContentRoot, locale, "products"));
			const rawIds = files
				.filter((file) => file.endsWith(".mdx"))
				.map((file) => file.replace(/\.mdx$/, ""));
			const unknownIds = rawIds.filter((id) => !isProductId(id));
			if (unknownIds.length > 0) {
				throw new Error(
					`Locale ${locale} contains unregistered products: ${unknownIds.join(", ")}`,
				);
			}
			const ids = rawIds.filter(isProductId);
			return [locale, ids] as const;
		}),
	),
);
const defaultProductIds = productIdsByLocale.get(DEFAULT_LOCALE) ?? [];
if (
	defaultProductIds.length !== PRODUCT_IDS.length ||
	PRODUCT_IDS.some((id) => !defaultProductIds.includes(id))
) {
	throw new Error("The default locale must include every registered product.");
}
const legalFilesByLocale = new Map(
	await Promise.all(
		ABOUT_LOCALES.map(async (locale) => {
			try {
				const files = await readdir(join(localeContentRoot, locale, "legal"));
				return [
					locale,
					files
						.filter((file) => file.endsWith(".mdx"))
						.map((file) => file.replace(/\.mdx$/, "")),
				] as const;
			} catch {
				return [locale, [] as string[]] as const;
			}
		}),
	),
);
const legalSlugs = [...new Set([...legalFilesByLocale.values()].flat())];
const legalDocumentCount = [...legalFilesByLocale.values()].reduce(
	(count, slugs) => count + slugs.length,
	0,
);
const documentationFilesByLocale = new Map(
	await Promise.all(
		ABOUT_LOCALES.map(async (locale) => {
			const directory = join(localeContentRoot, locale, "docs");
			const files = await findMdxFiles(directory);
			return [
				locale,
				files.map((file) =>
					relative(directory, file)
						.replace(/\.mdx$/u, "")
						.split(sep)
						.join("/"),
				),
			] as const;
		}),
	),
);
const documentationSlugs = [...new Set([...documentationFilesByLocale.values()].flat())];
const documentationDocumentCount = [...documentationFilesByLocale.values()].reduce(
	(count, slugs) => count + slugs.length,
	0,
);
const expectedUrlCount =
	ABOUT_LOCALES.length * 4 +
	[...productIdsByLocale.values()].reduce((count, productIds) => count + productIds.length, 0) +
	legalDocumentCount +
	documentationDocumentCount +
	1;

const sitemap = await readFile(join(distRoot, "sitemap.xml"), "utf8");
const sitemapUrls = sitemap.match(/<url>/g) ?? [];
if (sitemapUrls.length !== expectedUrlCount) {
	throw new Error(`Expected ${expectedUrlCount} sitemap URLs, found ${sitemapUrls.length}.`);
}

const expectedFunctionRoutes = [
	"/",
	"/how-it-works",
	"/how-it-works/",
	"/uses",
	"/uses/",
	"/products",
	"/products/*",
	"/contact-us",
	"/contact-us/",
	"/legal/*",
	"/docs/*",
] as const;
const functionRoutes = JSON.parse(
	await readFile(join(distRoot, "_routes.json"), "utf8"),
) as unknown;
if (
	typeof functionRoutes !== "object" ||
	functionRoutes === null ||
	!("version" in functionRoutes) ||
	functionRoutes.version !== 1 ||
	!("include" in functionRoutes) ||
	!Array.isArray(functionRoutes.include) ||
	functionRoutes.include.length !== expectedFunctionRoutes.length ||
	functionRoutes.include.some((route, index) => route !== expectedFunctionRoutes[index]) ||
	!("exclude" in functionRoutes) ||
	!Array.isArray(functionRoutes.exclude) ||
	functionRoutes.exclude.length !== 0
) {
	throw new Error("Cloudflare Functions routes must contain only unprefixed public entries.");
}

for (const locale of ABOUT_LOCALES) {
	const homePath = getHomePath(locale);
	const home = await readOutput(homePath);
	if (
		!home.includes('class="page-section home-contact"') ||
		!home.includes(`href="${getContactPath()}"`)
	) {
		throw new Error(`Missing the contact call to action in ${homePath}`);
	}

	const canonicalPaths = [
		homePath,
		getHowItWorksPath(locale),
		getUsesPath(locale),
		getProductsPath(locale),
		...(productIdsByLocale.get(locale) ?? []).map((id) =>
			getProductPath(locale, getProductById(id).slug),
		),
	];

	for (const publicPath of canonicalPaths) {
		const html = await readOutput(publicPath);
		const canonical = new URL(publicPath, ABOUT_SITE_ORIGIN).toString();
		if (!html.includes(`rel="canonical" href="${canonical}"`)) {
			throw new Error(`Missing canonical ${canonical} in ${publicPath}`);
		}
	}

	if (locale !== DEFAULT_LOCALE) {
		const available = new Set(productIdsByLocale.get(locale) ?? []);
		for (const productId of PRODUCT_IDS) {
			if (available.has(productId)) continue;
			const slug = getProductById(productId).slug;
			const fallbackPath = getProductPath(DEFAULT_LOCALE, slug);
			const html = await readOutput(getProductPath(locale, slug));
			if (
				!html.includes(`url=${fallbackPath}`) ||
				!html.includes(`rel="canonical" href="${new URL(fallbackPath, ABOUT_SITE_ORIGIN)}"`)
			) {
				throw new Error(`Missing ${locale} fallback redirect for ${productId}.`);
			}
		}
	}
}

const contactPath = getContactPath(DEFAULT_LOCALE);
const contact = await readOutput(contactPath);
const contactCanonical = new URL(contactPath, ABOUT_SITE_ORIGIN).toString();
if (!contact.includes(`rel="canonical" href="${contactCanonical}"`)) {
	throw new Error(`Missing canonical ${contactCanonical} in ${contactPath}`);
}
for (const locale of ABOUT_LOCALES) {
	if (locale === DEFAULT_LOCALE) continue;
	const html = await readOutput(getContactPath(locale));
	if (
		!html.includes(`url=${contactPath}`) ||
		!html.includes(`rel="canonical" href="${contactCanonical}"`)
	) {
		throw new Error(`Missing ${locale} contact fallback redirect.`);
	}
}

for (const slug of legalSlugs) {
	for (const locale of ABOUT_LOCALES) {
		const html = await readOutput(getLegalPath(locale, slug));
		const hasDocument = legalFilesByLocale.get(locale)?.includes(slug) ?? false;
		if (hasDocument) {
			const canonical = new URL(getLegalPath(locale, slug), ABOUT_SITE_ORIGIN).toString();
			if (!html.includes(`rel="canonical" href="${canonical}"`)) {
				throw new Error(`Missing canonical ${canonical} in legal document ${slug}.`);
			}
			continue;
		}

		const fallbackPath = getLegalPath(DEFAULT_LOCALE, slug);
		if (locale === DEFAULT_LOCALE || !html.includes(`url=${fallbackPath}`)) {
			throw new Error(`Missing ${locale} legal fallback redirect for ${slug}.`);
		}
	}
}

for (const slug of documentationSlugs) {
	for (const locale of ABOUT_LOCALES) {
		const html = await readOutput(getDocumentationPath(locale, slug));
		const hasDocument = documentationFilesByLocale.get(locale)?.includes(slug) ?? false;
		if (hasDocument) {
			const canonical = new URL(
				getDocumentationPath(locale, slug),
				ABOUT_SITE_ORIGIN,
			).toString();
			if (!html.includes(`rel="canonical" href="${canonical}"`)) {
				throw new Error(
					`Missing canonical ${canonical} in documentation document ${slug}.`,
				);
			}
			continue;
		}

		const fallbackPath = getDocumentationPath(DEFAULT_LOCALE, slug);
		if (locale === DEFAULT_LOCALE || !html.includes(`url=${fallbackPath}`)) {
			throw new Error(`Missing ${locale} documentation fallback for ${slug}.`);
		}
	}
}

const englishHome = await readOutput(getHomePath("en"));
for (const locale of ABOUT_LOCALES) {
	const alternate = new URL(getHomePath(locale), ABOUT_SITE_ORIGIN).toString();
	const languageTag = ABOUT_LOCALE_META[locale].htmlLang;
	if (!englishHome.includes(`hreflang="${languageTag}" href="${alternate}"`)) {
		throw new Error(`Missing ${locale} alternate on the English home page.`);
	}
}
if (!englishHome.includes('href="https://www.rezics.com/"')) {
	throw new Error("The main-app call to action is missing its canonical root.");
}
if (/href="https:\/\/www\.rezics\.com\/(?:zh-hant|zh-hans|en|ja|de|ko)\//.test(englishHome)) {
	throw new Error("The main-app call to action must not include a locale path.");
}

for (const unsupportedPath of ["/en/product/", "/en/products/catalog/", "/product/"]) {
	if (await outputExists(unsupportedPath)) {
		throw new Error(`Unsupported pre-v1 output exists: ${unsupportedPath}`);
	}
}

console.log(
	`Verified ${expectedUrlCount} canonical pages, fallback redirects, language alternates, app links, and the absence of pre-v1 outputs.`,
);
