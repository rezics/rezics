import type { MDXContent } from "mdx/types";
import type { LazyExoticComponent } from "react";

import { ABOUT_LOCALES, type AboutLocale } from "../i18n/locales";
import { PRODUCT_DEFINITIONS, type ProductId } from "./productRegistry";
import { getProductDocumentKey } from "./productDocumentTypes";
import { parseProductDocumentAddress } from "./productDocumentMetadata";

export type ProductDocumentComponent = MDXContent | LazyExoticComponent<MDXContent>;
export type ProductDocumentEntry = readonly [string, ProductDocumentComponent];

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function readMdxContent(value: unknown, source: string): MDXContent {
	if (typeof value !== "function") {
		throw new Error(`Product document has no renderable default export: ${source}`);
	}

	// The MDX compiler is the trusted source of the component contract; the
	// runtime check above rejects missing and non-callable exports.
	return value as MDXContent;
}

export function readMdxModule(value: unknown, source: string): MDXContent {
	if (!isRecord(value)) {
		throw new Error(`Product document is not a module: ${source}`);
	}
	return readMdxContent(value.default, source);
}

export function createProductDocumentResolver(
	entries: Iterable<ProductDocumentEntry>,
): (locale: AboutLocale, productId: ProductId) => ProductDocumentComponent {
	const documentByKey = new Map<string, ProductDocumentComponent>();

	for (const [path, document] of entries) {
		const address = parseProductDocumentAddress(path);
		const key = getProductDocumentKey(address.locale, address.productId);
		if (documentByKey.has(key)) {
			throw new Error(`Duplicate product document module: ${path}`);
		}
		documentByKey.set(key, document);
	}

	for (const locale of ABOUT_LOCALES) {
		for (const product of PRODUCT_DEFINITIONS) {
			const key = getProductDocumentKey(locale, product.id);
			if (!documentByKey.has(key)) {
				throw new Error(
					`Missing product document module for locale "${locale}" and product "${product.id}"`,
				);
			}
		}
	}

	return (locale, productId) => {
		const document = documentByKey.get(getProductDocumentKey(locale, productId));
		if (!document) {
			throw new Error(`Product document is unavailable: ${locale}/${productId}`);
		}
		return document;
	};
}
