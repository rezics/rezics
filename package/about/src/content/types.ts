import type { AboutPageId } from "../i18n/locales";

export type ContentSection = {
  eyebrow: string;
  title: string;
  body: string;
};

export type ProductFeature = {
  title: string;
  body: string;
};

export type ProductEntry = {
  eyebrow: string;
  name: string;
  summary: string;
  features: ProductFeature[];
};

export type AboutPageFrontmatter = {
  title: string;
  description: string;
  hero: {
    eyebrow: string;
    heading: string;
    body: string;
  };
  primaryCtaPage?: AboutPageId;
  sections: ContentSection[];
  storySections?: ContentSection[];
  products?: ProductEntry[];
};
