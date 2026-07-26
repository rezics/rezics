import { PRODUCT_DEFINITIONS } from "./content/productRegistry";
import { ABOUT_LOCALES } from "./i18n/locales";
import {
	getCanonicalForPath,
	getContactPath,
	getHomePath,
	getProductPath,
	getProductsPath,
} from "./i18n/productPaths";

export function createSitemapXml(): string {
	const urls = ABOUT_LOCALES.flatMap((locale) =>
		[
			getHomePath(locale),
			getProductsPath(locale),
			getContactPath(locale),
			...PRODUCT_DEFINITIONS.map((product) => getProductPath(locale, product.slug)),
		].map(getCanonicalForPath),
	);
	return (
		'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
		urls.map((url) => "  <url><loc>" + url + "</loc></url>").join("\n") +
		"\n</urlset>\n"
	);
}
