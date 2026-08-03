import { parse as parseCookie } from "cookie";
import { parseAcceptLanguage } from "native-i18n";
import { DefaultStoredUiLocale, isUiLocale, matchUiLocaleTag, type UiLocale } from "@rezics/i18n";

const UiLocaleCookieName = "NEXT_LOCALE";

/** Resolves the concrete UI locale carried by the request that creates a Profile. */
export function resolveRequestUiLocale(headers: Headers): UiLocale {
	const cookieHeader = headers.get("cookie");
	if (cookieHeader) {
		const cookieLocale = parseCookie(cookieHeader)[UiLocaleCookieName];
		if (cookieLocale && isUiLocale(cookieLocale)) return cookieLocale;
	}

	for (const tag of parseAcceptLanguage(headers.get("accept-language"))) {
		const locale = matchUiLocaleTag(tag);
		if (locale) return locale;
	}

	return DefaultStoredUiLocale;
}
