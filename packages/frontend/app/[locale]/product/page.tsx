import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  AboutSectionGrid,
  AboutStorySections,
} from "@/components/about/AboutSections";
import { AboutShell } from "@/components/about/AboutShell";
import { MarkdownFragment } from "@/components/about/MarkdownFragment";
import { getCommonCopy, getProductPageCopy } from "@/lib/about/content";
import {
  ABOUT_LOCALES,
  DEFAULT_LOCALE,
  type AboutLocale,
  isAboutLocale,
} from "@/lib/about/locales";
import { getMarkdownFragment } from "@/lib/about/markdown";
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
  const copy = getProductPageCopy(locale);
  return aboutMetadata(locale, "product", copy.meta);
}

export default async function AboutProductPage({ params }: LocalePageProps) {
  const { locale: rawLocale } = await params;
  if (!isAboutLocale(rawLocale)) notFound();

  const locale: AboutLocale = rawLocale;
  const common = getCommonCopy(locale);
  const copy = getProductPageCopy(locale);

  return (
    <AboutShell common={common} locale={locale} page="product">
      <section className="about-hero">
        <div className="about-hero-copy">
          <div>
            <p className="about-eyebrow">{copy.hero.eyebrow}</p>
            <h1>{copy.hero.heading}</h1>
          </div>
          <MarkdownFragment
            source={getMarkdownFragment(locale, "product", "hero")}
            variant="hero"
          />
        </div>
      </section>
      <section className="product-list">
        <div className="product-list-inner">
          {copy.products.map((product) => (
            <article className="product-row" key={product.name}>
              <div>
                <div className="product-badges">
                  <span>{product.category}</span>
                  <span className={product.status}>{product.statusLabel}</span>
                </div>
                <h2>{product.name}</h2>
                <p>{product.summary}</p>
              </div>
              <div className="product-detail">
                <ul>
                  {product.features.map((feature) => (
                    <li key={feature}>{feature}</li>
                  ))}
                </ul>
                {product.href && product.ctaLabel ? (
                  <a className="about-button" href={product.href}>
                    {product.ctaLabel}
                  </a>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      </section>
      <AboutSectionGrid sections={copy.sections} />
      <AboutStorySections sections={copy.storySections} />
      <section className="about-closing">
        <MarkdownFragment
          source={getMarkdownFragment(locale, "product", "closing")}
        />
      </section>
    </AboutShell>
  );
}
