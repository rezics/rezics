import type { AboutLocale } from "../../i18n/locales";
import de from "./de";
import en from "./en";
import ja from "./ja";
import ko from "./ko";
import zhHans from "./zh-hans";
import zhHant from "./zh-hant";

export type LocaleContent = typeof en;

const contentByLocale = {
	de,
	en,
	ja,
	ko,
	"zh-hans": zhHans,
	"zh-hant": zhHant,
} satisfies Record<AboutLocale, LocaleContent>;

export function getLocaleContent(locale: AboutLocale): LocaleContent {
	return contentByLocale[locale];
}
