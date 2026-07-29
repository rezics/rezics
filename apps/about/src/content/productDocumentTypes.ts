import type { ProductId, ProductSlug } from "./productRegistry";
import type { AboutLocale } from "../i18n/locales";

export type ProductDocumentMetadata = {
	readonly name: string;
	readonly summary: string;
	readonly introduction: string;
};

export type ProductDocumentAddress = {
	readonly locale: AboutLocale;
	readonly productId: ProductId;
	readonly slug: ProductSlug;
};

export function getProductDocumentKey(locale: AboutLocale, productId: ProductId): string {
	return `${locale}:${productId}`;
}
