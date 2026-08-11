import { getCollection, type CollectionEntry } from "astro:content";

import { ABOUT_LOCALES, type AboutLocale } from "../i18n/locales";
import { PRODUCT_DEFINITIONS, type ProductId, type RegisteredProduct } from "./productRegistry";

export type ProductDocument = CollectionEntry<"products">;

export type ProductDocumentWithDefinition = {
	readonly definition: RegisteredProduct;
	readonly document: ProductDocument;
};

let productDocumentsPromise: Promise<readonly ProductDocument[]> | undefined;

function loadProductDocuments(): Promise<readonly ProductDocument[]> {
	productDocumentsPromise ??= getCollection("products").then((documents) => {
		const seen = new Set<string>();

		for (const document of documents) {
			const [directoryLocale, directoryName] = document.id.split("/");
			if (directoryLocale !== document.data.locale || directoryName !== "products") {
				throw new Error(`Product locale mismatch: ${document.id} declares ${document.data.locale}`);
			}

			const key = `${document.data.locale}/${document.data.productId}`;
			if (seen.has(key)) throw new Error(`Duplicate product document: ${key}`);
			seen.add(key);
		}

		return documents;
	});

	return productDocumentsPromise;
}

export async function getProductDocuments(
	locale: AboutLocale,
): Promise<readonly ProductDocumentWithDefinition[]> {
	const documents = (await loadProductDocuments()).filter(({ data }) => data.locale === locale);
	const documentsById = new Map<ProductId, ProductDocument>(
		documents.map((document) => [document.data.productId, document]),
	);

	return PRODUCT_DEFINITIONS.flatMap((definition) => {
		const document = documentsById.get(definition.id);
		return document ? [{ definition, document }] : [];
	});
}

export async function getProductDocument(
	locale: AboutLocale,
	productId: ProductId,
): Promise<ProductDocument | undefined> {
	const products = await getProductDocuments(locale);
	return products.find(({ definition }) => definition.id === productId)?.document;
}

export async function getProductDocumentLocales(
	productId: ProductId,
): Promise<readonly AboutLocale[]> {
	const documents = await loadProductDocuments();
	const available = new Set(
		documents.filter(({ data }) => data.productId === productId).map(({ data }) => data.locale),
	);
	return ABOUT_LOCALES.filter((locale) => available.has(locale));
}

export async function requireCompleteProductLocale(locale: AboutLocale): Promise<void> {
	const documents = await getProductDocuments(locale);
	const available = new Set(documents.map(({ definition }) => definition.id));
	const missing = PRODUCT_DEFINITIONS.filter(({ id }) => !available.has(id));
	if (missing.length > 0) {
		throw new Error(
			`Locale ${locale} is missing required product documents: ${missing.map(({ id }) => id).join(", ")}`,
		);
	}
}
