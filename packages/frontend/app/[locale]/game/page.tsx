import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LibraryPlaceholderPage } from "@/components/about/LibraryPlaceholderPage";
import { getCommonCopy } from "@/lib/about/content";
import { getLibraryPageCopy } from "@/lib/about/library";
import {
  ABOUT_LOCALES,
  DEFAULT_LOCALE,
  type AboutLocale,
  isAboutLocale,
} from "@/lib/about/locales";
import { aboutMetadata } from "../../metadata";

type LocalePageProps = {
  params: Promise<{ locale: string }>;
};

export function generateStaticParams() {
  return ABOUT_LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: LocalePageProps): Promise<Metadata> {
  const { locale: rawLocale } = await params;
  const locale = isAboutLocale(rawLocale) ? rawLocale : DEFAULT_LOCALE;
  const copy = getLibraryPageCopy(locale, "game");
  return aboutMetadata(locale, "game", copy.meta);
}

export default async function GamePage({ params }: LocalePageProps) {
  const { locale: rawLocale } = await params;
  if (!isAboutLocale(rawLocale)) notFound();

  const locale: AboutLocale = rawLocale;
  return (
    <LibraryPlaceholderPage
      common={getCommonCopy(locale)}
      copy={getLibraryPageCopy(locale, "game")}
      locale={locale}
      page="game"
    />
  );
}
