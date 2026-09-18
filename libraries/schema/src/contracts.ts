import { z } from "zod";

/** @alpha Portable vocabulary contracts for schema tools and persistence adapters. */
export const IriSchema = z
	.string()
	.min(1)
	.max(65_536)
	.regex(/^[A-Za-z][A-Za-z0-9+.-]*:[^\u0000-\u0020<>"{}|^`\\]*$/u);
/** @alpha Digests identify immutable content, independently of display names or storage placement. */
export const DigestSchema = z.string().regex(/^[0-9a-f]{64}$/u);
const key = z.string().regex(/^[a-z][a-z0-9-]{0,63}$/u);
const named = z.strictObject({ termType: z.literal("NamedNode"), value: IriSchema });
const blank = z.strictObject({ termType: z.literal("BlankNode"), value: z.string().min(1) });
const literal = z.strictObject({
	termType: z.literal("Literal"),
	value: z.string(),
	datatype: named,
	language: z.string().default(""),
});
/** @alpha RDF 1.1 terms retain lexical values and dataset-scoped blank nodes. */
export const RdfQuadSchema = z.strictObject({
	subject: z.union([named, blank]),
	predicate: named,
	object: z.union([named, blank, literal]),
	graph: z.union([
		named,
		blank,
		z.strictObject({ termType: z.literal("DefaultGraph"), value: z.literal("") }),
	]),
});
export type RdfQuad = z.infer<typeof RdfQuadSchema>;

/** @alpha Each artifact is an explicit, bounded dependency; compilation performs no network access. */
export const SourceSchema = z.strictObject({
	key,
	version: z.string().min(1),
	url: z.url(),
	baseIri: IriSchema,
	namespaces: z.array(IriSchema).min(1),
	file: z.string().regex(/^[a-z0-9][a-z0-9.-]*\.(ttl|rdf|jsonld|nq)$/u),
	mediaType: z.enum([
		"text/turtle",
		"application/rdf+xml",
		"application/ld+json",
		"application/n-quads",
	]),
	sha256: DigestSchema,
	bytes: z.number().int().positive().max(16_777_216),
	license: z.string().min(1),
	contexts: z
		.array(
			z.strictObject({
				url: IriSchema,
				file: z.string().regex(/^[a-z0-9][a-z0-9.-]*\.jsonld$/u),
				sha256: DigestSchema,
			}),
		)
		.default([]),
});
export type VocabularySource = z.infer<typeof SourceSchema>;
/** @alpha Versioned import inputs; a vocabulary key has one selected release per bundle. */
export const SourceManifestSchema = z
	.strictObject({ format: z.literal(1), sources: z.array(SourceSchema).min(1).max(128) })
	.refine(
		(x) => new Set(x.sources.map((s) => s.key)).size === x.sources.length,
		"Duplicate vocabulary key",
	);

/** @alpha Shared logical addresses contain stable owner names, never table or shard names. */
export const LogicalReferenceSchema = z.strictObject({
	owner: z.string().regex(/^[a-z][a-z0-9_.-]{0,95}$/u),
	id: z.uuid(),
	revisionId: z.uuid().optional(),
});
export type LogicalReference = z.infer<typeof LogicalReferenceSchema>;
/** @alpha An exact lexical value is not coerced through JavaScript numbers or dates. */
export const SemanticValueSchema = z
	.discriminatedUnion("kind", [
		z.strictObject({ kind: z.literal("reference"), reference: LogicalReferenceSchema }),
		z.strictObject({ kind: z.literal("iri"), iri: IriSchema }),
		z.strictObject({
			kind: z.literal("literal"),
			value: z.string().max(65_536),
			datatype: IriSchema,
			language: z
				.string()
				.min(1)
				.max(255)
				.regex(/^[a-z]+(?:-[a-z0-9]+)*$/iu)
				.optional(),
		}),
		z.strictObject({ kind: z.literal("unknown") }),
		z.strictObject({ kind: z.literal("no-value") }),
	])
	.refine(
		(value) =>
			value.kind !== "literal" ||
			Boolean(value.language) ===
				(value.datatype === "http://www.w3.org/1999/02/22-rdf-syntax-ns#langString"),
		"Language-tagged literals require rdf:langString",
	);
export type SemanticValue = z.infer<typeof SemanticValueSchema>;

/** @alpha Definitions and labels are separate immutable content records. */
export const LabelSchema = z.strictObject({
	id: z.uuid(),
	termId: z.uuid(),
	predicate: IriSchema,
	value: z.string(),
	language: z.string(),
	datatype: IriSchema,
});
export type TermLabel = z.infer<typeof LabelSchema>;
/** @alpha Upstream assertions are preserved without becoming automatic application validation. */
export const DefinitionSchema = z.strictObject({
	id: z.uuid(),
	termId: z.uuid(),
	vocabularyId: z.uuid(),
	digest: DigestSchema,
	canonical: z.string(),
	types: z.array(IriSchema),
	status: z.enum(["active", "pending", "retired"]),
	replacements: z.array(IriSchema),
});
export type TermDefinition = z.infer<typeof DefinitionSchema>;
/** @alpha A term can be described by multiple vocabularies without merging their assertions. */
export const TermSchema = z.strictObject({
	id: z.uuid(),
	iri: IriSchema,
	aliases: z.array(IriSchema),
});
export type VocabularyTerm = z.infer<typeof TermSchema>;
/** @alpha Structured RDF nodes preserve original IRIs and lexical data independently of identity aliases. */
export const GraphNodeSchema = z.strictObject({
	id: z.uuid(),
	kind: z.enum(["iri", "blank", "literal", "default-graph"]),
	termId: z.uuid().nullable(),
	lexical: z.string(),
	datatypeId: z.uuid().nullable(),
	language: z.string().nullable(),
});
export type GraphNode = z.infer<typeof GraphNodeSchema>;
/** @alpha Exact graph membership and predicate spelling remain available for source-preserving export. */
export const GraphStatementSchema = z.strictObject({
	id: z.uuid(),
	subjectId: z.uuid(),
	predicateId: z.uuid(),
	predicateIri: IriSchema,
	objectId: z.uuid(),
	graphId: z.uuid(),
});
export type GraphStatement = z.infer<typeof GraphStatementSchema>;
/** @alpha The complete source graph is the authoritative retained representation. */
export const ReleaseSchema = z.strictObject({
	id: z.uuid(),
	vocabularyId: z.uuid(),
	source: SourceSchema,
	digest: DigestSchema,
	canonical: z.string(),
	quadCount: z.number().int().nonnegative(),
	definitions: z.array(DefinitionSchema),
	labels: z.array(LabelSchema),
	unindexedLabels: z.number().int().nonnegative(),
	nodes: z.array(GraphNodeSchema),
	statements: z.array(GraphStatementSchema),
});
export type VocabularyRelease = z.infer<typeof ReleaseSchema>;
/** @alpha Portable bundle format; byte integrity and reference validation are also required on import. */
export const BundleSchema = z.strictObject({
	format: z.literal(2),
	compiler: z.literal("rezics-schema/2"),
	id: z.uuid(),
	digest: DigestSchema,
	terms: z.array(TermSchema),
	releases: z.array(ReleaseSchema),
});
export type VocabularyBundle = z.infer<typeof BundleSchema>;

/** @alpha A profile pins interpretation and gives explicit closed-world rules for selected operations. */
export const ProfileSchema = z.strictObject({
	id: z.uuid(),
	key,
	revisionId: z.uuid(),
	digest: DigestSchema,
	types: z.array(z.uuid()).min(1),
	rules: z.array(
		z.strictObject({
			predicateId: z.uuid(),
			definitionId: z.uuid(),
			min: z.number().int().nonnegative(),
			max: z.number().int().positive().nullable(),
			ordered: z.boolean(),
			valueKinds: z.array(z.enum(["reference", "iri", "literal", "unknown", "no-value"])).min(1),
		}),
	),
	additionalProperties: z.boolean(),
});
export type ApplicationProfile = z.infer<typeof ProfileSchema>;

/** @alpha A binary assertion has its own identity and exact revision; evidence can reference either. */
export const RelationRevisionSchema = z.strictObject({
	id: z.uuid(),
	relationId: z.uuid(),
	subject: LogicalReferenceSchema,
	predicateId: z.uuid(),
	definitionId: z.uuid(),
	parentRevisionId: z.uuid().nullable(),
	changeId: z.uuid(),
	value: SemanticValueSchema,
	position: z
		.string()
		.max(40)
		.regex(/^(0|[1-9][0-9]*)$/u)
		.nullable(),
});
export type RelationRevision = z.infer<typeof RelationRevisionSchema>;
