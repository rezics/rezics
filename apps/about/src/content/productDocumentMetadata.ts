import {
	PRODUCT_DEFINITIONS,
	getProductBySlug,
	isProductSlug,
	type ProductId,
} from "./productRegistry";
import {
	getProductDocumentKey,
	type ProductDocumentAddress,
	type ProductDocumentMetadata,
} from "./productDocumentTypes";
import { ABOUT_LOCALES, isAboutLocale, type AboutLocale } from "../i18n/locales";

const productDocumentPath = /^\.\/locales\/([^/]+)\/products\/([^/]+)\.mdx$/;

const metadataByPath = import.meta.glob<unknown>("./locales/*/products/*.mdx", {
	eager: true,
	import: "default",
	query: "?product-metadata",
});

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readNonemptyString(
	record: Record<string, unknown>,
	field: keyof ProductDocumentMetadata,
	source: string,
): string {
	const value = record[field];
	if (typeof value !== "string" || value.trim().length === 0) {
		throw new Error(
			`Product document metadata "${field}" must be a nonempty string: ${source}`,
		);
	}
	return value;
}

function parseProductDocumentMetadata(value: unknown, source: string): ProductDocumentMetadata {
	if (!isRecord(value)) {
		throw new Error(`Product document metadata must be an object: ${source}`);
	}

	return Object.freeze({
		name: readNonemptyString(value, "name", source),
		summary: readNonemptyString(value, "summary", source),
		introduction: readNonemptyString(value, "introduction", source),
	});
}

export function parseProductDocumentAddress(path: string): ProductDocumentAddress {
	const match = productDocumentPath.exec(path);
	if (!match) {
		throw new Error(`Unexpected product document path: ${path}`);
	}

	const locale = match[1];
	const slug = match[2];
	if (!locale || !isAboutLocale(locale)) {
		throw new Error(`Unsupported product document locale: ${path}`);
	}
	if (!slug || !isProductSlug(slug)) {
		throw new Error(`Unregistered product document slug: ${path}`);
	}

	return {
		locale,
		productId: getProductBySlug(slug).id,
		slug,
	};
}

const metadataByKey = new Map<string, ProductDocumentMetadata>();

for (const [path, value] of Object.entries(metadataByPath)) {
	const address = parseProductDocumentAddress(path);
	const key = getProductDocumentKey(address.locale, address.productId);
	if (metadataByKey.has(key)) {
		throw new Error(`Duplicate product document: ${path}`);
	}
	metadataByKey.set(key, parseProductDocumentMetadata(value, path));
}

for (const locale of ABOUT_LOCALES) {
	for (const product of PRODUCT_DEFINITIONS) {
		const key = getProductDocumentKey(locale, product.id);
		if (!metadataByKey.has(key)) {
			throw new Error(
				`Missing product document for locale "${locale}" and product "${product.id}"`,
			);
		}
	}
}

export function getProductDocumentMetadata(
	locale: AboutLocale,
	productId: ProductId,
): ProductDocumentMetadata {
	const metadata = metadataByKey.get(getProductDocumentKey(locale, productId));
	if (!metadata) {
		throw new Error(`Product document metadata is unavailable: ${locale}/${productId}`);
	}
	return metadata;
}
