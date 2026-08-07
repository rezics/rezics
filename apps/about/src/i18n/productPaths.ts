import { ABOUT_LOCALES, ABOUT_SITE_ORIGIN, DEFAULT_LOCALE, type AboutLocale } from "./locales";

export type PublicPageKind =
	| "home"
	| "how-it-works"
	| "uses"
	| "products"
	| "product"
	| "contact"
	| "legal"
	| "docs";

export type AlternatePath = {
	readonly locale: AboutLocale;
	readonly path: string;
};

export function getHomePath(locale: AboutLocale): string {
	return `/${locale}/`;
}

export function getHowItWorksPath(locale: AboutLocale): string {
	return `/${locale}/how-it-works/`;
}

export function getUsesPath(locale: AboutLocale): string {
	return `/${locale}/uses/`;
}

export function getProductsPath(locale: AboutLocale): string {
	return `/${locale}/products/`;
}

export function getProductPath(locale: AboutLocale, slug: string): string {
	return `/${locale}/products/${slug}/`;
}

export function getLegalPath(locale: AboutLocale, slug: string): string {
	return `/${locale}/legal/${slug}/`;
}

export function getDocumentationPath(locale: AboutLocale, slug: string): string {
	return `/${locale}/docs/${slug}/`;
}

export function getContactPath(locale: AboutLocale = DEFAULT_LOCALE): string {
	return `/${locale}/contact-us/`;
}

export function getLocalizedPath(locale: AboutLocale, kind: PublicPageKind, slug?: string): string {
	switch (kind) {
		case "home":
			return getHomePath(locale);
		case "how-it-works":
			return getHowItWorksPath(locale);
		case "uses":
			return getUsesPath(locale);
		case "products":
			return getProductsPath(locale);
		case "product":
			if (!slug) throw new Error("A product slug is required.");
			return getProductPath(locale, slug);
		case "legal":
			if (!slug) throw new Error("A legal document slug is required.");
			return getLegalPath(locale, slug);
		case "docs":
			if (!slug) throw new Error("A documentation slug is required.");
			return getDocumentationPath(locale, slug);
		case "contact":
			return getContactPath(locale);
	}
}

export function getCanonicalForPath(path: string): string {
	return new URL(path, ABOUT_SITE_ORIGIN).toString();
}

export function getAlternatePaths(kind: PublicPageKind, slug?: string): readonly AlternatePath[] {
	const locales = kind === "contact" ? [DEFAULT_LOCALE] : ABOUT_LOCALES;
	return locales.map((locale) => ({
		locale,
		path: getLocalizedPath(locale, kind, slug),
	}));
}
