import { getDocumentationDocuments } from "../content/documentationDocuments";
import { getProductDocuments } from "../content/productDocuments";
import { getLegalDocuments } from "../content/legalDocuments";
import { ABOUT_LOCALES, DEFAULT_LOCALE } from "../i18n/locales";
import {
	getCanonicalForPath,
	getContactPath,
	getDocumentationPath,
	getHomePath,
	getHowItWorksPath,
	getLegalPath,
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
	const legalDocuments = await getLegalDocuments();
	const documentationDocuments = await getDocumentationDocuments();
	const urls = productsByLocale.flatMap(({ locale, products }) =>
		[
			getHomePath(locale),
			getHowItWorksPath(locale),
			getUsesPath(locale),
			getProductsPath(locale),
			...products.map(({ definition }) => getProductPath(locale, definition.slug)),
		].map(getCanonicalForPath),
	);
	urls.push(
		...legalDocuments.map(({ locale, slug }) =>
			getCanonicalForPath(getLegalPath(locale, slug)),
		),
	);
	urls.push(
		...documentationDocuments.map(({ locale, slug }) =>
			getCanonicalForPath(getDocumentationPath(locale, slug)),
		),
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
