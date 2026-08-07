import { getCollection, type CollectionEntry } from "astro:content";

import { ABOUT_LOCALES, isAboutLocale, type AboutLocale } from "../i18n/locales";

export type DocumentationDocument = CollectionEntry<"docs">;

export type DocumentationDocumentReference = {
	readonly locale: AboutLocale;
	readonly slug: string;
	readonly document: DocumentationDocument;
};

let documentationDocumentsPromise: Promise<readonly DocumentationDocumentReference[]> | undefined;

function parseDocumentationDocument(
	document: DocumentationDocument,
): DocumentationDocumentReference {
	const [directoryLocale, directoryName, ...slugSegments] = document.id.split("/");
	const slug = slugSegments.join("/");
	if (
		!directoryLocale ||
		!isAboutLocale(directoryLocale) ||
		directoryName !== "docs" ||
		slug.length === 0 ||
		slugSegments.some((segment) => segment.length === 0) ||
		document.data.locale !== directoryLocale
	) {
		throw new Error(`Documentation document path and locale mismatch: ${document.id}`);
	}

	return { locale: directoryLocale, slug, document };
}

function loadDocumentationDocuments(): Promise<readonly DocumentationDocumentReference[]> {
	documentationDocumentsPromise ??= getCollection("docs").then((documents) => {
		const seen = new Set<string>();
		return documents.map((document) => {
			const reference = parseDocumentationDocument(document);
			const key = `${reference.locale}/${reference.slug}`;
			if (seen.has(key)) throw new Error(`Duplicate documentation document: ${key}`);
			seen.add(key);
			return reference;
		});
	});

	return documentationDocumentsPromise;
}

export function getDocumentationDocuments(): Promise<readonly DocumentationDocumentReference[]> {
	return loadDocumentationDocuments();
}

export async function getDocumentationDocument(
	locale: AboutLocale,
	slug: string,
): Promise<DocumentationDocumentReference | undefined> {
	const documents = await loadDocumentationDocuments();
	return documents.find((document) => document.locale === locale && document.slug === slug);
}

export async function getDocumentationDocumentLocales(
	slug: string,
): Promise<readonly AboutLocale[]> {
	const documents = await loadDocumentationDocuments();
	const available = new Set(
		documents.filter((document) => document.slug === slug).map((document) => document.locale),
	);
	return ABOUT_LOCALES.filter((locale) => available.has(locale));
}
