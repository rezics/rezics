import { isAboutLocale } from "../../../../src/i18n/locales";
import { createProductsPageData } from "../../../../src/pageData.server";
import { render } from "vike/abort";

export const data = (pageContext: { routeParams: Record<string, string> }) => {
	const locale = pageContext.routeParams.locale;
	if (!isAboutLocale(locale)) throw render(404);
	return createProductsPageData(locale);
};
