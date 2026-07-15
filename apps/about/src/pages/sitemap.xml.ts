import { PRODUCT_DEFINITIONS } from "../content/productRegistry";
import { ABOUT_LOCALES } from "../i18n/locales";
import {
	getCanonicalForPath,
	getHomePath,
	getProductPath,
	getProductsPath,
} from "../i18n/productPaths";

export function GET(): Response {
	const urls = ABOUT_LOCALES.flatMap((locale) =>
		[
			getHomePath(locale),
			getProductsPath(locale),
			...PRODUCT_DEFINITIONS.map((product) => getProductPath(locale, product.slug)),
		].map(getCanonicalForPath),
	);

	return new Response(
		`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((url) => `  <url><loc>${url}</loc></url>`).join("\n")}
</urlset>
`,
		{ headers: { "content-type": "application/xml; charset=utf-8" } },
	);
}
