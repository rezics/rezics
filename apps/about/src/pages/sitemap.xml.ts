import { getProductDocuments } from "../content/productDocuments";
import { ABOUT_LOCALES, DEFAULT_LOCALE } from "../i18n/locales";
import {
	getCanonicalForPath,
	getContactPath,
	getHomePath,
	getHowItWorksPath,
	getProductPath,
	getProductsPath,
	getUsesPath,
} from "../i18n/productPaths";

export async function GET(): Promise<Response> {
	const productsByLocale = await Promise.all(
		ABOUT_LOCALES.map(async (locale) => ({
			locale,
			products: await getProductDocuments(locale),
		})),
	);
	const urls = productsByLocale.flatMap(({ locale, products }) =>
		[
			getHomePath(locale),
			getHowItWorksPath(locale),
			getUsesPath(locale),
			getProductsPath(locale),
			...products.map(({ definition }) => getProductPath(locale, definition.slug)),
		].map(getCanonicalForPath),
	);
	urls.push(getCanonicalForPath(getContactPath(DEFAULT_LOCALE)));

	return new Response(
		`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((url) => `  <url><loc>${url}</loc></url>`).join("\n")}
</urlset>
`,
		{ headers: { "content-type": "application/xml; charset=utf-8" } },
	);
}
