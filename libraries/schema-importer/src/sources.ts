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
		["rdf", "rdfs", "owl", "skos", "prov", "oa", "dcterms", "dctype", "dc", "bibframe", "shacl"] as const
	).map((key) => ({
		key,
		family: "vocabulary",
		reader: "rdf",
		input: "Turtle/RDF-XML",
		meaning: "Complete pinned machine vocabulary",
	})),
] as const;
