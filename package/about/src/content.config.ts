import { defineCollection, z } from "astro:content";

const pageCollection = defineCollection({
  type: "content",
  schema: z.object({
    title: z.string(),
    description: z.string(),
    hero: z.object({
      eyebrow: z.string(),
      heading: z.string(),
      body: z.string().array().min(1),
    }),
    primaryCtaPage: z.enum(["home", "product"]).optional(),
    sections: z
      .object({
        eyebrow: z.string(),
        title: z.string(),
        body: z.string(),
      })
      .array()
      .min(1),
    storySections: z
      .object({
        eyebrow: z.string(),
        title: z.string(),
        body: z.string(),
      })
      .array()
      .optional(),
    products: z
      .object({
        name: z.string(),
        category: z.string(),
        status: z.enum(["available", "preview", "planned"]),
        statusLabel: z.string(),
        summary: z.string(),
        href: z.string().optional(),
        ctaLabel: z.string().optional(),
        features: z.string().array().min(1),
      })
      .array()
      .optional(),
  }),
});

export const collections = {
  de: pageCollection,
  en: pageCollection,
  ja: pageCollection,
  ko: pageCollection,
  "zh-hans": pageCollection,
  "zh-hant": pageCollection,
};
