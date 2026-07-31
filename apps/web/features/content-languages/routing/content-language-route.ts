import type { ContentLanguage } from "@rezics/i18n";

const RelativeUrlBase = "https://rezics.invalid";

/** Add, replace, or clear the display-language override on an application href. */
export function withContentLanguage(href: string, language: ContentLanguage | undefined): string {
	const url = new URL(href, RelativeUrlBase);
	if (language) url.searchParams.set("language", language);
	else url.searchParams.delete("language");
	return `${url.pathname}${url.search}${url.hash}`;
}
