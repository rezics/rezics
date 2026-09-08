import type { IntakeCatalogSourceBody } from "@rezics/openapi-tanstack-query";

export const SourceProviders = ["vndb", "musicbrainz", "bangumi", "openlibrary"] as const;
export type SourceProvider = (typeof SourceProviders)[number];
export const SourceObjectTypes = {
	vndb: ["vn", "release", "staff", "producer", "character", "tag", "trait", "quote"],
	musicbrainz: [
		"release",
		"recording",
		"work",
		"release_group",
		"artist",
		"label",
		"area",
		"place",
		"event",
		"instrument",
		"series",
		"genre",
		"url",
	],
	bangumi: ["subject", "person", "character", "episode", "index"],
	openlibrary: ["work", "edition", "author"],
} as const;
export type SourceObjectType = (typeof SourceObjectTypes)[SourceProvider][number];
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
export function sourceIntakeBody(
	source: SourceProvider,
	objectType: string,
	externalId: string,
): IntakeCatalogSourceBody | null {
	const id = externalId.trim();
	if (!id || id.length > 512) return null;
	switch (source) {
		case "vndb": {
			const type = SourceObjectTypes.vndb.find((value) => value === objectType);
			return type ? { source, objectType: type, externalId: id } : null;
		}
		case "musicbrainz": {
			const type = SourceObjectTypes.musicbrainz.find((value) => value === objectType);
			return type && uuid.test(id)
				? { source, objectType: type, externalId: id.toLowerCase() }
				: null;
		}
		case "bangumi": {
			const type = SourceObjectTypes.bangumi.find((value) => value === objectType);
			return type && /^[1-9][0-9]*$/u.test(id)
				? { source, objectType: type, externalId: id }
				: null;
		}
		case "openlibrary": {
			const type = SourceObjectTypes.openlibrary.find((value) => value === objectType);
			return type ? { source, objectType: type, externalId: id } : null;
		}
	}
}
export function sourceProvider(value: string) {
	return SourceProviders.find((source) => source === value);
}
export function sourceObjectType(value: string) {
	return Object.values(SourceObjectTypes)
		.flat()
		.find((type) => type === value);
}
