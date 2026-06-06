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

export type AboutPageFrontmatter = {
  title: string;
  description: string;
  hero: {
    eyebrow: string;
    heading: string;
    body: string[];
  };
  primaryCtaPage?: AboutPageId;
  sections: ContentSection[];
  storySections?: ContentSection[];
  products?: ProductEntry[];
};
