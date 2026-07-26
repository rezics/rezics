import { PRODUCT_DEFINITIONS, type ProductId, type ProductSlug } from "./content/productRegistry";
import { getLocaleContent } from "./content/locales";
import { ABOUT_LOCALES, DEFAULT_LOCALE, type AboutLocale } from "./i18n/locales";
import {
	getAlternatePaths,
	getContactPath,
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
	const content = getLocaleContent(DEFAULT_LOCALE);
	return {
		kind: "root",
		metadata: makeMetadata(
			content.common.siteName,
			content.home.meta.description,
			getHomePath(DEFAULT_LOCALE),
			"home",
		),
	};
}

export function createHomePageData(locale: AboutLocale): AboutPageData {
	const content = getLocaleContent(locale);
	return {
		kind: "home",
		locale,
		metadata: makeMetadata(
			content.home.meta.title,
			content.home.meta.description,
			getHomePath(locale),
			"home",
		),
	};
}

export function createProductsPageData(locale: AboutLocale): AboutPageData {
	const content = getLocaleContent(locale);
	return {
		kind: "products",
		locale,
		metadata: makeMetadata(
			content.products.directory.meta.title,
			content.products.directory.meta.description,
			getProductsPath(locale),
			"products",
		),
	};
}

export function createContactPageData(locale: AboutLocale): AboutPageData {
	const content = getLocaleContent(locale);
	return {
		kind: "contact",
		locale,
		metadata: makeMetadata(
			content.contact.meta.title,
			content.contact.meta.description,
			getContactPath(locale),
			"contact",
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
	const localeContent = getLocaleContent(locale);
	const summary = localeContent.products.byId[productId].summaryText;
	const productName = localeContent.products.common.names[productId];
	const canonicalPath = getProductPath(locale, slug);
	return {
		kind: "product",
		locale,
		productId,
		slug,
		metadata: makeMetadata(
			productName + " — " + localeContent.common.siteName,
			summary,
			canonicalPath,
			"product",
			slug,
			{
				"@context": "https://schema.org",
				"@type": "SoftwareApplication",
				name: productName,
				description: summary,
				url: new URL(canonicalPath, "https://about.rezics.com").toString(),
				applicationCategory: "WebApplication",
			},
		),
	};
}

export function createErrorPageData(statusCode: 404 | 500 = 404): AboutPageData {
	const locale = DEFAULT_LOCALE;
	const content = getLocaleContent(locale);
	return {
		kind: "error",
		locale,
		statusCode,
		metadata: makeMetadata(
			content.common.notFound.title + " — " + content.common.siteName,
			content.common.notFound.body,
			getHomePath(locale),
			"home",
		),
	};
}

export const getPrerenderHomeUrls = () => ABOUT_LOCALES.map(getHomePath);
export const getPrerenderProductsUrls = () => ABOUT_LOCALES.map(getProductsPath);
export const getPrerenderContactUrls = () => ABOUT_LOCALES.map(getContactPath);
export const getPrerenderProductUrls = () =>
	ABOUT_LOCALES.flatMap((locale) =>
		PRODUCT_DEFINITIONS.map((product) => getProductPath(locale, product.slug)),
	);
