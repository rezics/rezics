import { getTableName } from "drizzle-orm";
import * as tables from "./postgres/index";
import type { VocabularyRegistry } from "./registry";

/** @alpha Concrete native grains; an external class never silently selects among different referents. */
const nativeClasses = {
	Person: [tables.entityIdentity],
	Organization: [tables.entityIdentity],
	Place: [tables.referencePlace],
	Event: [tables.referenceEvent],
	Book: [tables.publishingWork, tables.publishingPublication, tables.publishingTextVersion],
	MusicComposition: [tables.musicWork],
	MusicRecording: [tables.musicRecording],
	MusicRelease: [tables.musicRelease],
	Movie: [tables.programWork, tables.programVersion],
	TVSeries: [tables.programWork],
	TVSeason: [tables.programSeason],
	TVEpisode: [tables.programEpisode],
	SoftwareApplication: [tables.softwareIdentity, tables.softwareRelease],
	VideoGame: [tables.softwareIdentity, tables.softwareRelease],
	ImageObject: [tables.mediaItem, tables.mediaRepresentation],
	VideoObject: [tables.mediaItem, tables.mediaRepresentation],
	AudioObject: [tables.mediaItem, tables.mediaRepresentation],
	Article: [tables.wikiPage, tables.post],
	WebPage: [tables.wikiPage],
	DiscussionForumPosting: [tables.post],
	Comment: [tables.post],
	Message: [tables.message],
} as const;

/**
 * Complete selected-vocabulary storage dispositions, including every inherited property.
 * @alpha
 * @remarks Bindings describe storage capabilities. They are not permission grants or automatic source-record adoption.
 */
export function vocabularyStorageBindings(registry: VocabularyRegistry) {
	const release = registry.release("schemaorg");
	return release.definitions
		.filter((definition) => registry.term(definition.termId).iri.startsWith("https://schema.org/"))
		.map((definition) => {
			const term = registry.term(definition.termId),
				name = term.iri.slice("https://schema.org/".length);
			const native = Object.hasOwn(nativeClasses, name)
				? nativeClasses[name as keyof typeof nativeClasses]
				: null;
			const property = definition.types.includes(
				"http://www.w3.org/1999/02/22-rdf-syntax-ns#Property",
			);
			return {
				termId: term.id,
				iri: term.iri,
				definitionId: definition.id,
				kind: property
					? "property"
					: definition.types.includes("http://www.w3.org/2000/01/rdf-schema#Class")
						? "class"
						: "vocabulary-member",
				mode: native
					? "explicit-native-profile"
					: property
						? "typed-assertion"
						: "generic-description",
				tables: native
					? native.map(getTableName)
					: property
						? [
								getTableName(tables.descriptionStatement),
								getTableName(tables.schemaRelationRevision),
							]
						: [getTableName(tables.descriptionObject), getTableName(tables.descriptionType)],
				identityRule:
					native && native.length > 1
						? "Explicit referent/representation profile is required; class name alone does not choose a grain"
						: "Stable logical identity independent of table placement",
				query: ["identity", "subject-predicate", "exact-lexical-value", "reverse-reference"],
			};
		});
}
