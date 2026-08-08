import type { AboutLocale } from "../../i18n/locales";
import { deContent } from "./de/content";
import { enContent } from "./en/content";
import { jaContent } from "./ja/content";
import { koContent } from "./ko/content";
import type { SiteCopy } from "./contract";
import { zhHansContent } from "./zh-hans/content";
import { zhHantContent } from "./zh-hant/content";

export {
	CONTACT_LOCALES,
	getContactCopy,
	isContactLocale,
} from "./contact";
export type { ContactLocale } from "./contact";
export type { ContactCopy, MainPageId, PageId, SiteCopy } from "./contract";

const contentByLocale = {
	"zh-hant": zhHantContent,
	"zh-hans": zhHansContent,
	en: enContent,
	ja: jaContent,
	de: deContent,
	ko: koContent,
} satisfies Record<AboutLocale, SiteCopy>;

export function getSiteCopy(locale: AboutLocale): SiteCopy {
	return contentByLocale[locale];
}
