import { OpenLibraryContractSha256, OpenLibraryDocumentSchema, openLibrarySourceKey } from "./openlibrary";

/**
 * @internal Exact human-requested Work, Edition and Author lookups.
 * @remarks https://openlibrary.org/dev/docs/restful_api and
 * https://openlibrary.org/dev/docs/api/authors define these identity URLs.
 * Bulk acquisition uses the provider's dumps, never repeated lookup requests.
 */
export function openLibraryAcquisitionDescriptor(objectType: string, externalId: string) {
	const key = openLibrarySourceKey(externalId);
	if (key.objectType !== objectType)
		throw new TypeError("Open Library lookup identity has another bibliographic grain");
	return {
		url: `https://openlibrary.org${key.externalId}.json`,
		method: "GET" as const,
		contractSha256: OpenLibraryContractSha256,
		// Absence/redirect is review evidence, not an authoritative deletion claim.
		authoritativeGone: false,
		parse(input: unknown) {
			const document = OpenLibraryDocumentSchema.parse({ kind: key.objectType, record: input });
			if (document.record.key !== key.externalId)
				throw new TypeError("Open Library returned another identity requiring review");
			return document.record;
		},
	};
}
