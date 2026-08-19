export const VerbatimTermCategoryValues = [
	"brand",
	"protocol",
	"format",
	"identifier",
	"domain-identifier",
	"product",
] as const;

export type VerbatimTermCategory = (typeof VerbatimTermCategoryValues)[number];

type VerbatimTermDefinition = {
	readonly value: string;
	readonly category: VerbatimTermCategory;
	readonly rationale: string;
	readonly scope?: "about";
};

/**
 * Canonical spellings that remain verbatim in every locale.
 *
 * Locale resources may compose these values into translated copy, but must not
 * duplicate their spellings. Additions require a concrete interoperability,
 * identifier, trademark, or product-language reason; this is not a general
 * allowlist for untranslated source-language prose.
 */
export const verbatimTerms = {
	rezics: {
		value: "REZICS",
		category: "brand",
		rationale: "Project brand spelling.",
	},
	rezicsInc: {
		value: "Rezics Inc.",
		category: "brand",
		rationale: "Legal name of the copyright holder supplied by the maintainer.",
	},
	rezicsUnitContentLicenseV1: {
		value: "REZICS Unit Content License 1.0",
		category: "product",
		rationale: "Canonical title of the immutable v1 Unit content license.",
	},
	studio: {
		value: "Studio",
		category: "product",
		rationale: "User-confirmed name for the REZICS authoring workspace.",
	},
	privilegedApiQuotaClass: {
		value: "Privileged",
		category: "product",
		rationale: "Canonical name of the elevated account API quota class.",
	},
	github: {
		value: "GitHub",
		category: "brand",
		rationale: "External service brand spelling.",
	},
	rezicsRepository: {
		value: "rezics/rezics",
		category: "domain-identifier",
		rationale: "Canonical GitHub repository coordinate.",
	},
	edgeCoordinates: {
		value: "Edge-coordinates",
		category: "domain-identifier",
		rationale: "Maintainer's canonical GitHub account identifier.",
		scope: "about",
	},
	edgeCoordinatesEmail: {
		value: "Edgecoordinates@gmail.com",
		category: "identifier",
		rationale: "Maintainer's canonical contact email address.",
		scope: "about",
	},
	fontAwesome: {
		value: "Font Awesome",
		category: "brand",
		rationale: "External icon provider brand spelling.",
	},
	outline: {
		value: "Outline",
		category: "brand",
		rationale: "External documentation product brand spelling.",
	},
	react: {
		value: "React",
		category: "brand",
		rationale: "Framework brand spelling.",
	},
	vike: {
		value: "Vike",
		category: "brand",
		rationale: "Framework brand spelling.",
	},
	cc: {
		value: "CC",
		category: "brand",
		rationale: "Creative Commons brand initialism.",
	},
	pdm: {
		value: "PDM",
		category: "identifier",
		rationale: "Canonical initialism for the Creative Commons Public Domain Mark.",
	},
	api: {
		value: "API",
		category: "protocol",
		rationale: "Widely interoperable technical initialism.",
	},
	cdn: {
		value: "CDN",
		category: "protocol",
		rationale: "Widely interoperable content-delivery-network initialism.",
	},
	openapi: {
		value: "OpenAPI",
		category: "protocol",
		rationale: "Specification name.",
	},
	envFile: {
		value: ".env",
		category: "identifier",
		rationale: "Conventional environment-file name used by local development tools.",
	},
	apiPolicyOperationId: {
		value: "x-rezics-policy-operation-id",
		category: "identifier",
		rationale: "OpenAPI extension key used to configure per-operation token policy limits.",
	},
	oauth: {
		value: "OAuth",
		category: "protocol",
		rationale: "Protocol name.",
	},
	mcp: {
		value: "MCP",
		category: "protocol",
		rationale: "Protocol initialism.",
	},
	ai: {
		value: "AI",
		category: "identifier",
		rationale: "Widely recognized technical initialism.",
	},
	http: {
		value: "http",
		category: "protocol",
		rationale: "URI scheme identifier.",
	},
	https: {
		value: "https",
		category: "protocol",
		rationale: "URI scheme identifier.",
	},
	mailto: {
		value: "mailto",
		category: "protocol",
		rationale: "URI scheme identifier.",
	},
	url: {
		value: "URL",
		category: "identifier",
		rationale: "Widely interoperable technical initialism.",
	},
	id: {
		value: "ID",
		category: "identifier",
		rationale: "Stable identifier label used in technical interfaces.",
	},
	profileSlugPrefix: {
		value: "u/",
		category: "identifier",
		rationale: "Canonical public Profile slug route prefix.",
	},
	isbn13: {
		value: "ISBN-13",
		category: "identifier",
		rationale: "International Standard Book Number format identifier.",
	},
	r15: {
		value: "R15",
		category: "identifier",
		rationale: "Content-rating identifier.",
	},
	r18: {
		value: "R18",
		category: "identifier",
		rationale: "Content-rating identifier.",
	},
	r18g: {
		value: "R18G",
		category: "identifier",
		rationale: "Content-rating identifier.",
	},
	dag: {
		value: "DAG",
		category: "identifier",
		rationale: "Directed acyclic graph initialism used in technical diagrams.",
	},
	ascii: {
		value: "ASCII",
		category: "format",
		rationale: "Character-encoding standard name.",
	},
	json: {
		value: "JSON",
		category: "format",
		rationale: "Data format name.",
	},
	portableText: {
		value: "Portable Text",
		category: "format",
		rationale: "Structured rich-text specification name used by the REZICS editor.",
	},
	markdown: {
		value: "Markdown",
		category: "format",
		rationale: "Plain-text markup format name.",
	},
	html: {
		value: "HTML",
		category: "format",
		rationale: "Hypertext markup format initialism.",
	},
	utf8: {
		value: "UTF-8",
		category: "format",
		rationale: "Interoperable Unicode encoding identifier.",
	},
	mdFileExtension: {
		value: ".md",
		category: "identifier",
		rationale: "Canonical short REZICS Markdown file extension.",
	},
	markdownFileExtension: {
		value: ".markdown",
		category: "identifier",
		rationale: "Canonical long REZICS Markdown file extension.",
	},
	codeMirror6: {
		value: "CodeMirror 6",
		category: "brand",
		rationale: "Editor framework name used in the documented editing roadmap.",
	},
	jsonLd: {
		value: "JSON-LD",
		category: "format",
		rationale: "Linked-data format name.",
	},
	csv: {
		value: "CSV",
		category: "format",
		rationale: "Comma-separated values data format name.",
	},
	mime: {
		value: "MIME",
		category: "format",
		rationale: "Media type standard initialism.",
	},
	jpeg: {
		value: "JPEG",
		category: "format",
		rationale: "Image format name.",
	},
	png: {
		value: "PNG",
		category: "format",
		rationale: "Image format name.",
	},
	webp: {
		value: "WebP",
		category: "format",
		rationale: "Image format name.",
	},
	avif: {
		value: "AVIF",
		category: "format",
		rationale: "Image format name.",
	},
	mib: {
		value: "MiB",
		category: "format",
		rationale: "Binary data-size unit symbol.",
	},
	rss: {
		value: "RSS",
		category: "format",
		rationale: "Syndication format initialism.",
	},
	atom: {
		value: "Atom",
		category: "format",
		rationale: "Syndication format name.",
	},
	agpl30: {
		value: "AGPL-3.0",
		category: "identifier",
		rationale: "SPDX license identifier.",
	},
	contentStructure: {
		value: "ContentStructure",
		category: "domain-identifier",
		rationale: "Domain model identifier shown in technical product surfaces.",
		scope: "about",
	},
	gameContentStructure: {
		value: "GameContentStructure",
		category: "domain-identifier",
		rationale: "Domain model identifier shown in technical product surfaces.",
		scope: "about",
	},
	creditAttribution: {
		value: "CreditAttribution",
		category: "domain-identifier",
		rationale: "Domain model identifier shown in technical product surfaces.",
		scope: "about",
	},
	subjectAssociation: {
		value: "SubjectAssociation",
		category: "domain-identifier",
		rationale: "Domain model identifier shown in technical product surfaces.",
		scope: "about",
	},
	collectionArray: {
		value: "Collection[]",
		category: "domain-identifier",
		rationale: "Domain type expression shown in product formulas.",
		scope: "about",
	},
	kindWiki: {
		value: "kind=WIKI",
		category: "domain-identifier",
		rationale: "Domain discriminator expression shown in product formulas.",
		scope: "about",
	},
	kindPicture: {
		value: "kind=PICTURE",
		category: "domain-identifier",
		rationale: "Domain discriminator expression shown in product formulas.",
		scope: "about",
	},
	kindReview: {
		value: "kind=REVIEW",
		category: "domain-identifier",
		rationale: "Domain discriminator expression shown in product formulas.",
		scope: "about",
	},
	blockSchema: {
		value: "Block Schema",
		category: "domain-identifier",
		rationale: "Internal protocol name shown in technical product surfaces.",
		scope: "about",
	},
	bookTitleField: {
		value: "Book.title",
		category: "domain-identifier",
		rationale: "Domain field path shown in history examples.",
		scope: "about",
	},
	postBlockField: {
		value: "Post.block",
		category: "domain-identifier",
		rationale: "Domain field path shown in history examples.",
		scope: "about",
	},
	zoneConfigField: {
		value: "Zone.config",
		category: "domain-identifier",
		rationale: "Domain field path shown in history examples.",
		scope: "about",
	},
	paragraphBlockField: {
		value: "paragraph.block",
		category: "domain-identifier",
		rationale: "Domain field path shown in history examples.",
		scope: "about",
	},
	feedQueryField: {
		value: "feed.query",
		category: "domain-identifier",
		rationale: "Domain field path shown in history examples.",
		scope: "about",
	},
	entranceNode: {
		value: "Entrance",
		category: "domain-identifier",
		rationale: "Game-content node identifier shown in structural diagrams.",
		scope: "about",
	},
	passageNode: {
		value: "Passage",
		category: "domain-identifier",
		rationale: "Game-content node identifier shown in structural diagrams.",
		scope: "about",
	},
	endingNode: {
		value: "Ending",
		category: "domain-identifier",
		rationale: "Game-content node identifier shown in structural diagrams.",
		scope: "about",
	},
	entryEdge: {
		value: "entry",
		category: "domain-identifier",
		rationale: "Game-content edge identifier shown in structural diagrams.",
		scope: "about",
	},
	terminalEdge: {
		value: "terminal",
		category: "domain-identifier",
		rationale: "Game-content edge identifier shown in structural diagrams.",
		scope: "about",
	},
	journeyStep: {
		value: "JourneyStep",
		category: "domain-identifier",
		rationale: "Domain record identifier shown in gamebook examples.",
		scope: "about",
	},
} as const satisfies Readonly<Record<string, VerbatimTermDefinition>>;

export type VerbatimTermKey = keyof typeof verbatimTerms;
