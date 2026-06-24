import type { AboutPageId } from "../i18n/locales";

export type ContentSection = {
  eyebrow: string;
  title: string;
  body: string;
};

export type ProductStatus = "available" | "preview" | "planned";

export type ProductEntry = {
  name: string;
  category: string;
  status: ProductStatus;
  statusLabel: string;
  summary: string;
  href?: string;
  ctaLabel?: string;
  features: string[];
};

export type AboutCommonCopy = {
  nav: {
    home: string;
    product: string;
    app: string;
    language: string;
  };
  cta: {
    enterApp: string;
    readProduct: string;
    backHome: string;
  };
  footer: {
    originNote: string;
  };
  notFound: {
    title: string;
    body: string;
  };
};

export type AboutPageMeta = {
  title: string;
  description: string;
};

export type AboutHeroCopy = {
  eyebrow: string;
  heading: string;
};

export type BaseAboutPageCopy = {
  meta: AboutPageMeta;
  hero: AboutHeroCopy;
  sections: ContentSection[];
  storySections: ContentSection[];
};

export type HomePageCopy = BaseAboutPageCopy & {
  primaryCtaPage: AboutPageId;
};

export type ProductPageCopy = BaseAboutPageCopy & {
  products: ProductEntry[];
};

export type AboutPageCopyByPage = {
  home: HomePageCopy;
  product: ProductPageCopy;
};

export type MarkdownFragmentSlug = "hero" | "closing";
