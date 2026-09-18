import type {
	NativeModelDecision,
	PropertyDecision,
	OperationalDecision,
} from "../src/model/contracts";
const schema = "https://schema.org/",
	bf = "http://id.loc.gov/ontologies/bibframe/",
	skos = "http://www.w3.org/2004/02/skos/core#",
	prov = "http://www.w3.org/ns/prov#",
	oa = "http://www.w3.org/ns/oa#",
	dc = "http://purl.org/dc/terms/",
	xsd = "http://www.w3.org/2001/XMLSchema#",
	rdf = "http://www.w3.org/1999/02/22-rdf-syntax-ns#";
const type = (
	iri: string,
	vocabulary: string,
	relationship: "exact" | "specialization" | "projection",
	reason: string,
) => ({ iri, vocabulary, relationship, reason });
const local = (key: string, growth: string) => ({
	key,
	growth,
	splitUnit: "Identity with authoritative revisions and selections",
	crossOwnerIntegrity:
		"Local concrete FKs; explicit endpoint validation and erasure delivery when crossing stores",
});
const title = (table: string, writer: string): PropertyDecision => ({
	iri: schema + "name",
	vocabulary: "schemaorg",
	meaning: "A multilingual selected name, not an immutable identifier or a forced global title.",
	min: 0,
	max: null,
	ordered: false,
	valueKinds: ["literal"],
	datatypes: [xsd + "string", rdf + "langString"],
	storage: {
		kind: "localized-value",
		table,
		columns: ["owner_id", "value", "language_tag"],
		writer,
	},
});
const relation = (
	iri: string,
	vocabulary: string,
	meaning: string,
	owner: string,
	writer: string,
): PropertyDecision => ({
	iri,
	vocabulary,
	meaning,
	min: 0,
	max: null,
	ordered: true,
	valueKinds: ["reference"],
	targetOwners: ["entity"],
	storage: {
		kind: "native-relation",
		table: `${owner}_relation_participant`,
		columns: [
			"owner_id",
			"relation_id",
			"role_revision_id",
			"entity_id",
			"position",
			"credited_as",
		],
		writer,
		transform:
			"Qualified credit occurrence: exact relation definition and role; source text without a resolved Agent remains descriptive evidence.",
	},
});
const identity = (table: string) => ({ table, id: "id", requiresUniversalParent: false as const });
const semantic = (
	iri: string,
	vocabulary: string,
	meaning: string,
	kinds: PropertyDecision["valueKinds"],
	minimum = 0,
	maximum: number | null = null,
	datatypes: string[] = [],
): PropertyDecision => ({
	iri,
	vocabulary,
	meaning,
	min: minimum,
	max: maximum,
	ordered: false,
	valueKinds: kinds,
	datatypes,
	storage: {
		kind: "semantic-relation",
		table: "description_statement",
		columns: [
			"object_id",
			"revision_id",
			"id",
			"predicate_id",
			"definition_id",
			"state",
			"lexical",
			"external_iri",
		],
		writer: "semantic.descriptions",
	},
});
const profile = (
	key: string,
	owner: string,
	grain: string,
	table: string,
	types: NativeModelDecision["types"],
	properties: PropertyDecision[],
	growth: string,
): NativeModelDecision => ({
	key,
	owner,
	grain,
	types,
	identity: identity(table),
	properties: properties.map((rule) =>
		table !== "description_object" && rule.storage.kind === "semantic-relation"
			? {
					...rule,
					storage: {
						kind: "semantic-relation",
						table: "schema_relation_revision",
						columns: ["relation_id", "predicate_id", "definition_id", "value"],
						writer: "semantic.relations",
					},
				}
			: rule,
	),
	additionalProperties: "descriptive-only",
	locality: local("id", growth),
});

/** Human-reviewed semantic decisions. Same-named concepts across standards are not merged automatically. */
export const nativeModels: NativeModelDecision[] = [
	profile(
		"person",
		"entity",
		"A described person, independent of any private account.",
		"entity_identity",
		[
			type(
				schema + "Person",
				"schemaorg",
				"specialization",
				"Native Entity shape person; an imported description creates no login or authority.",
			),
			type(
				bf + "Person",
				"bibframe",
				"specialization",
				"Bibliographic Agent person projects to the same native referent with explicit identity evidence.",
			),
		],
		[title("entity_named_form", "catalog.names")],
		"Agent identities and name revisions",
	),
	profile(
		"organization",
		"entity",
		"An organization referent; control and membership are separate.",
		"entity_identity",
		[
			type(
				schema + "Organization",
				"schemaorg",
				"specialization",
				"Native organization identity; classification conveys no permissions.",
			),
			type(bf + "Organization", "bibframe", "specialization", "Bibliographic organization Agent."),
		],
		[title("entity_named_form", "catalog.names")],
		"Organization identities; independent authority data",
	),
	profile(
		"book-work",
		"publishing",
		"Conceptual publishing work, not a publication or owned copy.",
		"publishing_work",
		[
			type(
				schema + "Book",
				"schemaorg",
				"projection",
				"This profile chooses the Work interpretation; Book alone is ambiguous.",
			),
			type(
				bf + "Work",
				"bibframe",
				"specialization",
				"BIBFRAME Work does not silently collapse native text/expression versions.",
			),
		],
		[
			title("publishing_named_form", "catalog.names"),
			relation(
				schema + "author",
				"schemaorg",
				"Authorship credit is identified and ordered by explicit native policy.",
				"publishing",
				"catalog.relations",
			),
			relation(
				schema + "creator",
				"schemaorg",
				"Broader creative contribution; do not infer every creator is an author.",
				"publishing",
				"catalog.relations",
			),
		],
		"Works, distinct text versions, credits and edit history",
	),
	profile(
		"publication",
		"publishing",
		"A particular published manifestation; no fabricated universal Edition parent.",
		"publishing_publication",
		[
			type(
				schema + "Book",
				"schemaorg",
				"projection",
				"A publication can be exposed as Book only with this explicit grain.",
			),
			type(
				bf + "Instance",
				"bibframe",
				"specialization",
				"A published instance remains distinct from a Work and an Item.",
			),
		],
		[
			title("publishing_named_form", "catalog.names"),
			{
				iri: schema + "numberOfPages",
				vocabulary: "schemaorg",
				meaning: "Optional known page count; textual pagination is a distinct field.",
				min: 0,
				max: 1,
				ordered: false,
				valueKinds: ["literal"],
				datatypes: [xsd + "nonNegativeInteger"],
				storage: {
					kind: "column",
					table: "publishing_publication",
					columns: ["page_count"],
					writer: "publishing.structure",
					transform:
						"Exact integer within the declared native safe-integer bound; preserve unrepresentable source pagination as evidence.",
				},
			},
		],
		"Publication identities and release/format facets",
	),
	profile(
		"text-version",
		"publishing",
		"A language/text version may realize or adapt multiple works.",
		"publishing_text_version",
		[
			type(
				schema + "CreativeWork",
				"schemaorg",
				"specialization",
				"Explicit textual referent, not equated automatically with bf:Work.",
			),
		],
		[
			{
				iri: schema + "inLanguage",
				vocabulary: "schemaorg",
				meaning:
					"Canonical BCP47 language of this text version; multilingual content can remain unspecified.",
				min: 0,
				max: 1,
				ordered: false,
				valueKinds: ["literal"],
				datatypes: [xsd + "string"],
				storage: {
					kind: "column",
					table: "publishing_text_version",
					columns: ["language_tag"],
					writer: "publishing.structure",
					transform: "BCP47 canonicalization with original source preserved",
				},
			},
		],
		"Text versions and ordered composition",
	),
	profile(
		"bibliographic-item",
		"description",
		"An individual physical or digital copy, separate from an Instance.",
		"description_object",
		[
			type(
				bf + "Item",
				"bibframe",
				"exact",
				"Semantic Item descriptions are supported without inventing circulation or ownership authority.",
			),
		],
		[
			semantic(
				bf + "itemOf",
				"bibframe",
				"Copy-to-instance assertion; incomplete descriptions may lack a resolved instance.",
				["reference", "iri"],
			),
			semantic(
				bf + "heldBy",
				"bibframe",
				"A described holding Agent is not an application permission grant.",
				["reference", "iri"],
			),
		],
		"Lower item count than media occurrences; retain copy-specific evidence",
	),
	profile(
		"bibliographic-contribution",
		"description",
		"An identified bibliographic contribution with Agent and role assertions.",
		"description_object",
		[
			type(
				bf + "Contribution",
				"bibframe",
				"specialization",
				"Keep the contribution node and its role; projecting to an author credit requires a reviewed role mapping.",
			),
		],
		[
			semantic(
				bf + "agent",
				"bibframe",
				"Agent of this contribution; unresolved IRIs remain explicit.",
				["reference", "iri"],
				1,
			),
			semantic(
				bf + "role",
				"bibframe",
				"Role identity is retained; unknown relator IRIs are never guessed to mean author.",
				["reference", "iri"],
			),
		],
		"Qualified contribution occurrences, not duplicate books",
	),
	profile(
		"music-work",
		"music",
		"Musical composition independent of a recording or release.",
		"music_work",
		[type(schema + "MusicComposition", "schemaorg", "specialization", "Native composition grain.")],
		[
			title("music_named_form", "catalog.names"),
			relation(
				schema + "composer",
				"schemaorg",
				"Identified composition contributor.",
				"music",
				"catalog.relations",
			),
		],
		"Works, credits and score/recording relationships",
	),
	profile(
		"music-recording",
		"music",
		"A recording distinct from its release track occurrences.",
		"music_recording",
		[
			type(
				schema + "MusicRecording",
				"schemaorg",
				"specialization",
				"Recording identity is retained across track appearances.",
			),
		],
		[
			title("music_named_form", "catalog.names"),
			relation(
				schema + "creator",
				"schemaorg",
				"Recording contribution with explicit native role.",
				"music",
				"catalog.relations",
			),
		],
		"Recordings and repeated release-track occurrences",
	),
	profile(
		"music-release",
		"music",
		"Published release identity and its media/track structure.",
		"music_release",
		[
			type(
				schema + "MusicRelease",
				"schemaorg",
				"specialization",
				"Release is not a universal catalog edition.",
			),
		],
		[title("music_named_form", "catalog.names")],
		"Releases, media, tracks and histories",
	),
	profile(
		"program-work",
		"program",
		"An audiovisual program Work; versions and episodes are independent referents.",
		"program_work",
		[
			type(
				schema + "Movie",
				"schemaorg",
				"projection",
				"Choose work grain explicitly rather than a video binary.",
			),
			type(
				schema + "TVSeries",
				"schemaorg",
				"specialization",
				"Series work; membership/composition does not create one global Work parent.",
			),
		],
		[
			title("program_named_form", "catalog.names"),
			relation(
				schema + "creator",
				"schemaorg",
				"Creative contribution with independent role and credit position.",
				"program",
				"catalog.relations",
			),
		],
		"Programs and deep composition/revision histories",
	),
	profile(
		"program-version",
		"program",
		"A specific audiovisual cut/version, distinct from encoded files.",
		"program_version",
		[
			type(
				schema + "CreativeWork",
				"schemaorg",
				"specialization",
				"A semantic version is not an encoding.",
			),
		],
		[title("program_named_form", "catalog.names")],
		"Versions and local structure",
	),
	profile(
		"episode",
		"program",
		"Episode identity, separate from occurrences in seasons or collections.",
		"program_episode",
		[
			type(
				schema + "TVEpisode",
				"schemaorg",
				"specialization",
				"Repeated appearances retain one episode referent.",
			),
		],
		[title("program_named_form", "catalog.names")],
		"Episodes and ordered occurrences",
	),
	profile(
		"software",
		"software",
		"Software work/application identity, independent of builds, releases and packages.",
		"software_identity",
		[
			type(
				schema + "SoftwareApplication",
				"schemaorg",
				"projection",
				"A work/application view; release profiles must be chosen explicitly.",
			),
			type(
				schema + "VideoGame",
				"schemaorg",
				"specialization",
				"Game-specific capabilities do not force a separate provider-owned model.",
			),
		],
		[
			title("software_named_form", "catalog.names"),
			relation(
				schema + "creator",
				"schemaorg",
				"Identified software contribution.",
				"software",
				"catalog.relations",
			),
		],
		"Works, builds/releases and distribution observations",
	),
	...(["image", "video", "audio"] as const).map((kind) =>
		profile(
			`indexed-${kind}`,
			"indexed_media",
			`Conceptual indexed ${kind}, not its URL, bytes or page appearance.`,
			"media_item",
			[
				type(
					schema + { image: "ImageObject", video: "VideoObject", audio: "AudioObject" }[kind],
					"schemaorg",
					"projection",
					"The conceptual asset interpretation requires an explicit profile; binary representations use a separate profile.",
				),
			],
			[
				semantic(
					schema + "creator",
					"schemaorg",
					"Media authorship uses identified assertions; metadata-revision editor attribution is a different fact.",
					["reference", "iri"],
				),
				semantic(
					dc + "license",
					"dcterms",
					"License evidence applies to this referent and revision; it does not authorize downloading.",
					["reference", "iri"],
				),
			],
			"Potential trillion-scale identities with independently multiplying observations/appearances",
		),
	),
	profile(
		"media-representation",
		"media-representation",
		"One encoding/representation of an indexed asset.",
		"media_representation",
		[
			type(
				schema + "MediaObject",
				"schemaorg",
				"specialization",
				"Technical representation grain; not equated with a creative Work.",
			),
		],
		[
			{
				iri: schema + "encodingFormat",
				vocabulary: "schemaorg",
				meaning: "Known media/MIME format of this representation.",
				min: 1,
				max: 1,
				ordered: false,
				valueKinds: ["literal"],
				datatypes: [xsd + "string"],
				storage: {
					kind: "column",
					table: "media_representation",
					columns: ["mime_type"],
					writer: "media.representations",
				},
			},
			semantic(
				schema + "contentUrl",
				"schemaorg",
				"Observed retrieval address belongs to a representation/observation, not binary identity.",
				["iri"],
			),
		],
		"Representations, streams and fragments; shard with media locality",
	),
	profile(
		"wiki-page",
		"wiki",
		"Editable Wiki page identity with per-language histories.",
		"wiki_page",
		[
			type(
				schema + "WebPage",
				"schemaorg",
				"specialization",
				"Page/document identity is distinct from what it describes.",
			),
		],
		[
			semantic(
				schema + "about",
				"schemaorg",
				"Page topic is an explicit relationship, not identity equivalence.",
				["reference", "iri"],
			),
			semantic(
				dc + "subject",
				"dcterms",
				"Subject classification does not change the topic referent.",
				["reference", "iri"],
			),
		],
		"Fewer roots than media/forum; language revisions and outgoing links dominate",
	),
	profile(
		"forum-post",
		"post",
		"Authored forum post; reply/root structure has its native owner.",
		"post",
		[
			type(
				schema + "DiscussionForumPosting",
				"schemaorg",
				"specialization",
				"Forum authoring and thread placement retain native lifecycle.",
			),
		],
		[
			semantic(
				schema + "about",
				"schemaorg",
				"A discussion subject is not its author or container.",
				["reference", "iri"],
			),
		],
		"Very large post/reply, reaction and revision counts; locality by thread/root",
	),
	profile(
		"message",
		"message",
		"Private message, allocated locally inside a conversation.",
		"message",
		[
			type(
				schema + "Message",
				"schemaorg",
				"specialization",
				"Messaging identity does not require a global content parent.",
			),
		],
		[
			{
				iri: schema + "text",
				vocabulary: "schemaorg",
				meaning:
					"Authored message payload; erased messages omit it, while the native live-message writer requires nonblank content.",
				min: 0,
				max: 1,
				ordered: false,
				valueKinds: ["literal"],
				datatypes: [xsd + "string"],
				storage: {
					kind: "column",
					table: "message",
					columns: ["content"],
					writer: "messaging.messages",
					transform: "Live authored message only; erasure is a separate lifecycle command",
				},
			},
		],
		"Highest sustained writes; conversation-local sequence and erasure",
	),
	profile(
		"concept",
		"description",
		"A described SKOS concept; classification does not create permissions.",
		"description_object",
		[
			type(
				skos + "Concept",
				"skos",
				"exact",
				"Concept identity is separate from all of its labels.",
			),
		],
		[
			{
				...semantic(
					skos + "prefLabel",
					"skos",
					"Preferred label per language; one untagged default label is an explicit native policy.",
					["literal"],
					0,
					null,
					[rdf + "langString", xsd + "string"],
				),
				uniqueLanguage: true,
			},
			semantic(
				skos + "altLabel",
				"skos",
				"Alternative labels retain independent lexical forms.",
				["literal"],
				0,
				null,
				[rdf + "langString", xsd + "string"],
			),
			semantic(
				skos + "broader",
				"skos",
				"A stated conceptual hierarchy; no automatic SQL inheritance.",
				["reference", "iri"],
			),
			semantic(
				skos + "inScheme",
				"skos",
				"Scheme membership is independent from broader/narrower relations.",
				["reference", "iri"],
			),
		],
		"Concepts and multilingual statements",
	),
	profile(
		"concept-scheme",
		"description",
		"A concept scheme groups concepts without becoming their identity parent.",
		"description_object",
		[
			type(
				skos + "ConceptScheme",
				"skos",
				"exact",
				"Schemes are first-class descriptive resources.",
			),
		],
		[
			semantic(skos + "hasTopConcept", "skos", "Explicit top concept in this scheme.", [
				"reference",
				"iri",
			]),
		],
		"Small scheme metadata and potentially large membership sets",
	),
	profile(
		"edit-activity",
		"change",
		"One edit activity; sources and reviews reference the same edit or revision.",
		"schema_change",
		[
			type(
				prov + "Activity",
				"prov",
				"specialization",
				"Native edit is one kind of provenance activity; no duplicate source-content model.",
			),
		],
		[
			semantic(
				prov + "used",
				"prov",
				"Evidence used in this edit; an external URI may remain unresolved.",
				["reference", "iri"],
			),
			semantic(
				prov + "wasAssociatedWith",
				"prov",
				"Activity participant attribution is separate from application authorization.",
				["reference", "iri"],
			),
		],
		"Actual edit rate, independently of total indexed objects",
	),
	profile(
		"annotation",
		"description",
		"An annotation with independent identity, bodies and exact targets.",
		"description_object",
		[
			type(
				oa + "Annotation",
				"oa",
				"specialization",
				"Native annotation requires at least one explicit target; body may be absent for tagging/linking motives.",
			),
		],
		[
			semantic(
				oa + "hasTarget",
				"oa",
				"Target may include an exact revision and selector resource.",
				["reference", "iri"],
				1,
			),
			semantic(oa + "hasBody", "oa", "Multiple bodies retain occurrence identity.", [
				"reference",
				"iri",
				"literal",
			]),
			semantic(
				oa + "motivatedBy",
				"oa",
				"Motivation is an identified concept, not a status enum.",
				["reference", "iri"],
			),
		],
		"Reviews and AI annotations grow with activity; colocate exact target histories",
	),
	profile(
		"specific-resource",
		"description",
		"An exact resource with selector/state context.",
		"description_object",
		[
			type(
				oa + "SpecificResource",
				"oa",
				"specialization",
				"Native specific resource resolves one source per selector context.",
			),
		],
		[
			semantic(
				oa + "hasSource",
				"oa",
				"Selector source is explicit; it is not a copied source-book object.",
				["reference", "iri"],
				1,
				1,
			),
			semantic(
				oa + "hasSelector",
				"oa",
				"Selectors remain independently identifiable and can be refined.",
				["reference", "iri"],
			),
		],
		"Target occurrences and refinements",
	),
	profile(
		"text-quote-selector",
		"description",
		"Text quote selector with original lexical evidence.",
		"description_object",
		[
			type(
				oa + "TextQuoteSelector",
				"oa",
				"exact",
				"Exact quote plus optional disambiguating context.",
			),
		],
		[
			semantic(oa + "exact", "oa", "Quoted text remains authored evidence.", ["literal"], 1, 1, [
				xsd + "string",
			]),
			semantic(oa + "prefix", "oa", "Context immediately preceding the quote.", ["literal"], 0, 1, [
				xsd + "string",
			]),
			semantic(oa + "suffix", "oa", "Context immediately following the quote.", ["literal"], 0, 1, [
				xsd + "string",
			]),
		],
		"Only explicit annotations create selectors",
	),
	profile(
		"described-resource",
		"description",
		"A source-independent descriptive resource without a native specialized workflow.",
		"description_object",
		[
			type(
				"http://www.w3.org/2000/01/rdf-schema#Resource",
				"rdfs",
				"specialization",
				"Fallback means descriptive support, not a claim that all product workflows exist.",
			),
		],
		[
			semantic(
				dc + "title",
				"dcterms",
				"Descriptive title; original lexical values and language survive.",
				["literal"],
				0,
				null,
				[xsd + "string", rdf + "langString"],
			),
			semantic(
				dc + "creator",
				"dcterms",
				"Descriptive creator assertion; not equated automatically with author or provenance actor.",
				["reference", "iri", "literal"],
			),
			semantic(dc + "source", "dcterms", "Source/evidence reference for the described resource.", [
				"reference",
				"iri",
			]),
		],
		"Unmapped descriptions partition by identity; no parent requirement on native owners",
	),
];

/** Explicit ownership of all existing Drizzle domains. Operational invariants cannot be inferred from vocabularies. */
export const operationalOwners: OperationalDecision[] = [
	...[
		"access",
		"identity",
		"integrations",
		"operations",
		"governance",
		"commerce",
		"realms",
		"discovery",
	].map((domain) => ({
		domain,
		authority: "native-operational" as const,
		reason:
			"Authority, payment, leases, delivery, consistency and lifecycle are authored application contracts; vocabulary types grant no capabilities.",
		sourceModel: `src/postgres/${domain}`,
	})),
	...[
		"shared",
		"catalog",
		"knowledge",
		"publishing",
		"music",
		"audiovisual",
		"software",
		"ingestion",
		"history",
		"documents",
		"media",
		"forum",
		"messaging",
		"community",
		"wiki",
		"vocabulary",
	].map((domain) => ({
		domain,
		authority: "native-domain" as const,
		reason:
			"Domain grains and concrete integrity remain explicitly authored; standard mappings and generated shared primitives are recorded separately.",
		sourceModel: `src/postgres/${domain}`,
	})),
];
