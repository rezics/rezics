import {
	PRODUCT_DEFINITIONS,
	type ProductId,
	type ProductSlug,
} from "../../../../src/content/productRegistry";
import { isAboutLocale } from "../../../../src/i18n/locales";
import { createProductPageData } from "../../../../src/pageData.server";
import { render } from "vike/abort";

export const data = (pageContext: { routeParams: Record<string, string> }) => {
	const locale = pageContext.routeParams.locale;
	const slug = pageContext.routeParams.slug;
	if (!isAboutLocale(locale)) throw render(404);
	const product = PRODUCT_DEFINITIONS.find((entry) => entry.slug === slug);
	if (!product) throw render(404);
	return createProductPageData(locale, product.id as ProductId, product.slug as ProductSlug);
};
