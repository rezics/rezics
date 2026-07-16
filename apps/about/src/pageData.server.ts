import { PRODUCT_DEFINITIONS, type ProductId, type ProductSlug } from "./content/productRegistry";
import { getLocalizedProductCopy } from "./content/productCopy";
import { getSiteCopy } from "./content/siteCopy";
import { ABOUT_LOCALES, DEFAULT_LOCALE, type AboutLocale } from "./i18n/locales";
import {
	getAlternatePaths,
	getHomePath,
	getProductPath,
	getProductsPath,
	type PublicPageKind,
} from "./i18n/productPaths";
import type { AboutPageData, AboutPageMetadata } from "./pageData";

function makeMetadata(
	title: string,
	description: string,
	canonicalPath: string,
	kind: PublicPageKind,
	slug?: string,
	jsonLd?: Record<string, unknown>,
): AboutPageMetadata {
	return { title, description, canonicalPath, alternates: getAlternatePaths(kind, slug), jsonLd };
}

export function createRootPageData(): AboutPageData {
	const copy = getSiteCopy(DEFAULT_LOCALE);
	return {
		kind: "root",
		metadata: makeMetadata(
			"Rezics",
			copy.home.meta.description,
			getHomePath(DEFAULT_LOCALE),
			"home",
		),
	};
}

export function createHomePageData(locale: AboutLocale): AboutPageData {
	const copy = getSiteCopy(locale);
	return {
		kind: "home",
		locale,
		metadata: makeMetadata(
			copy.home.meta.title,
			copy.home.meta.description,
			getHomePath(locale),
			"home",
		),
	};
}

export function createProductsPageData(locale: AboutLocale): AboutPageData {
	const copy = getSiteCopy(locale);
	return {
		kind: "products",
		locale,
		metadata: makeMetadata(
			copy.directory.meta.title,
			copy.directory.meta.description,
			getProductsPath(locale),
			"products",
		),
	};
}

export function createProductPageData(
	locale: AboutLocale,
	productId: ProductId,
	slug: ProductSlug,
): AboutPageData {
	const product = PRODUCT_DEFINITIONS.find((entry) => entry.id === productId);
	if (!product) throw new Error("Unknown product: " + productId);
	const localized = getLocalizedProductCopy(locale, productId);
	const canonicalPath = getProductPath(locale, slug);
	return {
		kind: "product",
		locale,
		productId,
		slug,
		metadata: makeMetadata(
			product.name + " — Rezics",
			localized.summary,
			canonicalPath,
			"product",
			slug,
			{
				"@context": "https://schema.org",
				"@type": "SoftwareApplication",
				name: product.name,
				description: localized.summary,
				url: new URL(canonicalPath, "https://about.rezics.com").toString(),
				applicationCategory: "WebApplication",
			},
		),
	};
}

export function createErrorPageData(statusCode: 404 | 500 = 404): AboutPageData {
	const locale = DEFAULT_LOCALE;
	const copy = getSiteCopy(locale);
	return {
		kind: "error",
		locale,
		statusCode,
		metadata: makeMetadata(
			copy.notFound.title + " — Rezics",
			copy.notFound.body,
			getHomePath(locale),
			"home",
		),
	};
}

export const getPrerenderHomeUrls = () => ABOUT_LOCALES.map(getHomePath);
export const getPrerenderProductsUrls = () => ABOUT_LOCALES.map(getProductsPath);
export const getPrerenderProductUrls = () =>
	ABOUT_LOCALES.flatMap((locale) =>
		PRODUCT_DEFINITIONS.map((product) => getProductPath(locale, product.slug)),
	);
