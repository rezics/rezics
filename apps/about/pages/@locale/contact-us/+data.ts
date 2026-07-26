import { render } from "vike/abort";

import { isAboutLocale } from "../../../src/i18n/locales";
import { createContactPageData } from "../../../src/pageData.server";

export const data = (pageContext: { routeParams: Record<string, string> }) => {
	const locale = pageContext.routeParams.locale;
	if (!isAboutLocale(locale)) throw render(404);
	return createContactPageData(locale);
};
