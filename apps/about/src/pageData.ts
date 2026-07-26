import type { ProductId, ProductSlug } from "./content/productRegistry";
import type { AboutPageMeta } from "./content/productTypes";
import type { AboutLocale } from "./i18n/locales";

export type AboutPageMetadata = AboutPageMeta & {
	canonicalPath: string;
	alternates: Record<AboutLocale, string>;
	jsonLd?: Record<string, unknown>;
};

export type AboutPageData =
	| { kind: "root"; metadata: AboutPageMetadata }
	| { kind: "home"; locale: AboutLocale; metadata: AboutPageMetadata }
	| { kind: "products"; locale: AboutLocale; metadata: AboutPageMetadata }
	| { kind: "contact"; locale: AboutLocale; metadata: AboutPageMetadata }
	| {
			kind: "product";
			locale: AboutLocale;
			productId: ProductId;
			slug: ProductSlug;
			metadata: AboutPageMetadata;
	  }
	| { kind: "error"; locale: AboutLocale; statusCode: 404 | 500; metadata: AboutPageMetadata };
