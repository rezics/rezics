import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  AboutSectionGrid,
  AboutStorySections,
} from "@/components/about/AboutSections";
import { AboutShell } from "@/components/about/AboutShell";
import { MarkdownFragment } from "@/components/about/MarkdownFragment";
import { getCommonCopy, getHomePageCopy } from "@/lib/about/content";
import {
  ABOUT_LOCALES,
  DEFAULT_LOCALE,
  type AboutLocale,
  getAppEntryUrl,
  getPagePath,
  isAboutLocale,
} from "@/lib/about/locales";
import { getMarkdownFragment } from "@/lib/about/markdown";
import { aboutMetadata } from "../metadata";

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
  const copy = getHomePageCopy(locale);
  return aboutMetadata(locale, "home", copy.meta);
}

export default async function AboutHomePage({ params }: LocalePageProps) {
  const { locale: rawLocale } = await params;
  if (!isAboutLocale(rawLocale)) notFound();

  const locale: AboutLocale = rawLocale;
  const common = getCommonCopy(locale);
  const copy = getHomePageCopy(locale);
  const primaryHref = getPagePath(locale, copy.primaryCtaPage);

  return (
    <AboutShell common={common} locale={locale} page="home">
      <section className="about-hero">
        <div className="about-hero-copy">
          <div>
            <p className="about-eyebrow">{copy.hero.eyebrow}</p>
            <h1>{copy.hero.heading}</h1>
          </div>
          <MarkdownFragment
            source={getMarkdownFragment(locale, "home", "hero")}
            variant="hero"
          />
          <div className="about-cta-row">
            <a className="about-button primary" href={primaryHref}>
              {common.cta.readProduct}
            </a>
            <a className="about-button" href={getAppEntryUrl(locale)}>
              {common.cta.enterApp}
            </a>
          </div>
        </div>
      </section>
      <AboutSectionGrid sections={copy.sections} />
      <AboutStorySections sections={copy.storySections} />
      <section className="about-closing">
        <MarkdownFragment
          source={getMarkdownFragment(locale, "home", "closing")}
        />
      </section>
    </AboutShell>
  );
}
