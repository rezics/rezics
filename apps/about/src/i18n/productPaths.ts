import { ABOUT_LOCALES, ABOUT_SITE_ORIGIN, type AboutLocale } from "./locales";

export type PublicPageKind = "home" | "products" | "product" | "contact";

export function getHomePath(locale: AboutLocale): string {
	return `/${locale}/`;
}

export function getProductsPath(locale: AboutLocale): string {
	return `/${locale}/products/`;
}

export function getProductPath(locale: AboutLocale, slug: string): string {
	return `/${locale}/products/${slug}/`;
}

export function getContactPath(locale: AboutLocale): string {
	return `/${locale}/contact-us/`;
}

export function getLocalizedPath(locale: AboutLocale, kind: PublicPageKind, slug?: string): string {
	if (kind === "home") return getHomePath(locale);
	if (kind === "products") return getProductsPath(locale);
	if (kind === "contact") return getContactPath(locale);
	if (!slug) throw new Error("A product slug is required for a product page.");
	return getProductPath(locale, slug);
}

export function getCanonicalForPath(path: string): string {
	return new URL(path, ABOUT_SITE_ORIGIN).toString();
}

export function getAlternatePaths(
	kind: PublicPageKind,
	slug?: string,
): Record<AboutLocale, string> {
	return Object.fromEntries(
		ABOUT_LOCALES.map((locale) => [locale, getLocalizedPath(locale, kind, slug)]),
	) as Record<AboutLocale, string>;
}
