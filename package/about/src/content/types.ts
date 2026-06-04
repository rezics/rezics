import type { AboutPageId } from "../i18n/locales";

export type ContentSection = {
  eyebrow: string;
  title: string;
  body: string;
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
};
