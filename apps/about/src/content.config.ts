import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

import { PRODUCT_IDS } from "./content/productRegistry";
import { ABOUT_LOCALES } from "./i18n/locales";

const products = defineCollection({
	loader: glob({
		base: "./src/content/locales",
		pattern: "*/products/*.mdx",
	}),
	schema: z.object({
		productId: z.enum(PRODUCT_IDS),
		locale: z.enum(ABOUT_LOCALES),
		title: z.string().trim().min(1),
		summary: z.string().trim().min(1),
		description: z.string().trim().min(1),
	}),
});

export const collections = { products };
