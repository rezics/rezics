/** @alpha Explicit converter/source selection. Formats and declared semantic coverage are independent. */
export const SchemaSources = [
	{
		key: "schemaorg",
		family: "vocabulary",
		reader: "rdf",
		input: "Turtle",
		meaning: "Complete Schema.org classes, properties, enumerations and retired terms",
	},
	...(
		["rdf", "rdfs", "owl", "skos", "prov", "oa", "dcterms", "dctype", "dc", "bibframe"] as const
	).map((key) => ({
		key,
		family: "vocabulary",
		reader: "rdf",
		input: "Turtle/RDF-XML",
		meaning: "Complete pinned machine vocabulary",
	})),
	{
		key: "bangumi",
		family: "provider",
		reader: "openapi-json-schema",
		input: "OpenAPI, JSON Schema, archive declarations, vocabularies",
		meaning: "Every pinned API/archive declaration with references and constraints",
	},
	{
		key: "musicbrainz",
		family: "provider",
		reader: "postgres-ddl",
		input: "CREATE TABLE, primary-key and foreign-key SQL",
		meaning: "Tables, columns, key and reference declarations; SQL is never executed",
	},
	{
		key: "vndb",
		family: "provider",
		reader: "vndb",
		input: "Kana field registry",
		meaning:
			"Selectable fields and inherited endpoint references; unspecified types remain explicit",
	},
	{
		key: "openlibrary",
		family: "provider",
		reader: "openlibrary",
		input: "Open Library .type documents",
		meaning: "Type/property declarations, reverse properties and external type references",
	},
	{
		key: "wikibase",
		family: "exchange",
		reader: "wikibase",
		input: "Items, Properties, Lexemes, Forms, Senses, MediaInfo",
		meaning: "Structured statements, snaks, qualifiers, references and exact lexical values",
	},
	{
		key: "iiif",
		family: "exchange",
		reader: "iiif",
		input: "IIIF Presentation 3 manifests and collections",
		meaning: "Canvases, annotation pages, annotations, bodies, targets and selectors",
	},
	{
		key: "media-fragments",
		family: "exchange",
		reader: "media-fragments",
		input: "URI fragments",
		meaning: "Temporal, spatial, track and named fragment dimensions",
	},
] as const;
