import { ABOUT_LOCALES, type AboutLocale } from "../../i18n/locales";
import type { ContactCopy } from "./contract";
import { enContactCopy } from "./en/contact";
import { zhHantContactCopy } from "./zh-hant/contact";

const contactCopyByLocale = {
	"zh-hant": zhHantContactCopy,
	en: enContactCopy,
} satisfies Partial<Record<AboutLocale, ContactCopy>>;

export type ContactLocale = keyof typeof contactCopyByLocale;

export function isContactLocale(locale: AboutLocale): locale is ContactLocale {
	return Object.hasOwn(contactCopyByLocale, locale);
}

export const CONTACT_LOCALES: readonly ContactLocale[] = ABOUT_LOCALES.filter(isContactLocale);

export function getContactCopy(locale: ContactLocale): ContactCopy {
	return contactCopyByLocale[locale];
}
