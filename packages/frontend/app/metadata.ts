import type { Metadata } from "next";
import type { AboutPageMeta } from "@/lib/about/types";
import {
  ABOUT_LOCALE_META,
  ABOUT_LOCALES,
  DEFAULT_LOCALE,
  type AboutLocale,
  type AboutPageId,
  getCanonicalUrl,
} from "@/lib/about/locales";

export function aboutMetadata(
  locale: AboutLocale,
  page: AboutPageId,
  meta: AboutPageMeta,
): Metadata {
  return {
    title: meta.title,
    description: meta.description,
    alternates: {
      canonical: getCanonicalUrl(locale, page),
      languages: {
        ...Object.fromEntries(
          ABOUT_LOCALES.map((alternateLocale) => [
            ABOUT_LOCALE_META[alternateLocale].htmlLang,
            getCanonicalUrl(alternateLocale, page),
          ]),
        ),
        "x-default": getCanonicalUrl(DEFAULT_LOCALE, page),
      },
    },
    openGraph: {
      type: "website",
      siteName: "Rezics",
      title: meta.title,
      description: meta.description,
      url: getCanonicalUrl(locale, page),
    },
  };
}
