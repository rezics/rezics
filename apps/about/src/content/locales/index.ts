import type { AboutLocale } from "../../i18n/locales";
import { zhHantContent, type LocaleContent } from "./zh-hant/content";

export type { LocaleContent } from "./zh-hant/content";

const contentByLocale = {
	"zh-hant": zhHantContent,
} as const satisfies Record<AboutLocale, LocaleContent>;

export function getLocaleContent(locale: AboutLocale): LocaleContent {
	return contentByLocale[locale];
}
