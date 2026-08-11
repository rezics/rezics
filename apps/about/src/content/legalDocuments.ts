import { getCollection, type CollectionEntry } from "astro:content";

import { ABOUT_LOCALES, isAboutLocale, type AboutLocale } from "../i18n/locales";

export type LegalDocument = CollectionEntry<"legal">;

export type LegalDocumentReference = {
	readonly locale: AboutLocale;
	readonly slug: string;
	readonly document: LegalDocument;
};

let legalDocumentsPromise: Promise<readonly LegalDocumentReference[]> | undefined;

function parseLegalDocument(document: LegalDocument): LegalDocumentReference {
	const [directoryLocale, directoryName, slug, extraSegment] = document.id.split("/");
	if (
		!directoryLocale ||
		!isAboutLocale(directoryLocale) ||
		directoryName !== "legal" ||
		!slug ||
		extraSegment !== undefined ||
		document.data.locale !== directoryLocale
	) {
		throw new Error(`Legal document path and locale mismatch: ${document.id}`);
	}

	return { locale: directoryLocale, slug, document };
}

function loadLegalDocuments(): Promise<readonly LegalDocumentReference[]> {
	legalDocumentsPromise ??= getCollection("legal").then((documents) => {
		const seen = new Set<string>();
		return documents.map((document) => {
			const reference = parseLegalDocument(document);
			const key = `${reference.locale}/${reference.slug}`;
			if (seen.has(key)) throw new Error(`Duplicate legal document: ${key}`);
			seen.add(key);
			return reference;
		});
	});

	return legalDocumentsPromise;
}

export function getLegalDocuments(): Promise<readonly LegalDocumentReference[]> {
	return loadLegalDocuments();
}

export async function getLegalDocument(
	locale: AboutLocale,
	slug: string,
): Promise<LegalDocumentReference | undefined> {
	const documents = await loadLegalDocuments();
	return documents.find((reference) => reference.locale === locale && reference.slug === slug);
}

export async function getLegalDocumentLocales(slug: string): Promise<readonly AboutLocale[]> {
	const documents = await loadLegalDocuments();
	const available = new Set(
		documents.filter((reference) => reference.slug === slug).map((reference) => reference.locale),
	);
	return ABOUT_LOCALES.filter((locale) => available.has(locale));
}
