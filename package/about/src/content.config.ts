import { defineCollection, z } from "astro:content";

const pageCollection = defineCollection({
  type: "content",
  schema: z.object({
    title: z.string(),
    description: z.string(),
    hero: z.object({
      eyebrow: z.string(),
      heading: z.string(),
      body: z.string(),
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
