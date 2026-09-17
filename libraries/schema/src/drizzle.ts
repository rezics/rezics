import { sql } from "drizzle-orm";
import {
	bigint,
	check,
	customType,
	foreignKey,
	index,
	jsonb,
	numeric,
	pgTable,
	primaryKey,
	text,
	timestamp,
	unique,
	uuid,
} from "drizzle-orm/pg-core";
import type { ApplicationProfile, SemanticValue, VocabularySource } from "./contracts";

const bytes = customType<{ data: Buffer; driverData: Buffer }>({ dataType: () => "bytea" });
const createdAt = () =>
	timestamp("created_at", { withTimezone: true, mode: "date", precision: 3 })
		.defaultNow()
		.notNull();
const version = () => bigint({ mode: "number" }).notNull();

/** @alpha Small replicated vocabulary metadata, independent of any content identity parent. */
export const schemaVocabulary = pgTable(
	"schema_vocabulary",
	{
		id: uuid().primaryKey(),
		key: text().notNull(),
	},
	(t) => [
		unique("schema_vocabulary_key").on(t.key),
		check("schema_vocabulary_key_shape", sql`${t.key} ~ '^[a-z][a-z0-9-]{0,63}$'`),
	],
);

/** @alpha Exact artifacts and their complete RDF graphs are retained together for offline replay. */
export const schemaRelease = pgTable(
	"schema_release",
	{
		id: uuid().primaryKey(),
		vocabularyId: uuid("vocabulary_id")
			.notNull()
			.references(() => schemaVocabulary.id),
		version: text().notNull(),
		digest: text().notNull(),
		source: jsonb().$type<VocabularySource>().notNull(),
		sourceBytes: bytes("source_bytes").notNull(),
		canonical: text().notNull(),
		createdAt: createdAt(),
	},
	(t) => [
		unique("schema_release_vocabulary_id").on(t.id, t.vocabularyId),
		unique("schema_release_content").on(t.vocabularyId, t.digest),
		check("schema_release_digest_shape", sql`${t.digest} ~ '^[0-9a-f]{64}$'`),
		check(
			"schema_release_source_bound",
			sql`octet_length(${t.sourceBytes}) <= 16777216 and jsonb_typeof(${t.source}) = 'object'`,
		),
		check(
			"schema_release_source_digest",
			sql`coalesce(encode(sha256(${t.sourceBytes}), 'hex') = ${t.source}->>'sha256', false)`,
		),
	],
);

/** @alpha Captured JSON-LD context bytes make transported releases independently replayable. */
export const schemaReleaseContext = pgTable(
	"schema_release_context",
	{
		releaseId: uuid("release_id")
			.notNull()
			.references(() => schemaRelease.id),
		sha256: text().notNull(),
		bytes: bytes().notNull(),
	},
	(t) => [
		primaryKey({ columns: [t.releaseId, t.sha256] }),
		check(
			"schema_release_context_bound",
			sql`octet_length(${t.bytes}) <= 1048576 and encode(sha256(${t.bytes}), 'hex') = ${t.sha256}`,
		),
	],
);

/** @alpha A selected release is an explicit deployment decision; latest import is not implicit adoption. */
export const schemaVocabularyHead = pgTable(
	"schema_vocabulary_head",
	{
		vocabularyId: uuid("vocabulary_id")
			.primaryKey()
			.references(() => schemaVocabulary.id),
		releaseId: uuid("release_id").notNull(),
		version: version(),
	},
	(t) => [
		foreignKey({
			columns: [t.releaseId, t.vocabularyId],
			foreignColumns: [schemaRelease.id, schemaRelease.vocabularyId],
		}),
		check("schema_vocabulary_head_version", sql`${t.version} between 1 and 9007199254740991`),
	],
);

/** @alpha A complete IRI is preserved; bounded hashes index long IRIs without truncating them. */
export const schemaTerm = pgTable(
	"schema_term",
	{
		id: uuid().primaryKey(),
		iri: text().notNull(),
		iriHash: text("iri_hash").notNull(),
	},
	(t) => [
		unique("schema_term_iri_hash").on(t.iriHash),
		check(
			"schema_term_iri_bounds",
			sql`octet_length(${t.iri}) between 1 and 262144 and encode(sha256(convert_to(${t.iri}, 'UTF8')), 'hex') = ${t.iriHash}`,
		),
	],
);

/** @alpha Aliases come only from an explicit vocabulary policy, never arbitrary sameAs assertions. */
export const schemaTermAlias = pgTable(
	"schema_term_alias",
	{
		iriHash: text("iri_hash").primaryKey(),
		iri: text().notNull(),
		termId: uuid("term_id")
			.notNull()
			.references(() => schemaTerm.id),
	},
	(t) => [
		index("schema_term_alias_term").on(t.termId),
		check(
			"schema_term_alias_hash",
			sql`encode(sha256(convert_to(${t.iri}, 'UTF8')), 'hex') = ${t.iriHash}`,
		),
	],
);

/** @alpha Meaning revisions exclude display-label triples and do not embed product cardinality rules. */
export const schemaDefinition = pgTable(
	"schema_definition",
	{
		id: uuid().primaryKey(),
		termId: uuid("term_id")
			.notNull()
			.references(() => schemaTerm.id),
		vocabularyId: uuid("vocabulary_id")
			.notNull()
			.references(() => schemaVocabulary.id),
		digest: text().notNull(),
		canonical: text().notNull(),
		types: jsonb().$type<string[]>().notNull(),
		status: text().$type<"active" | "pending" | "retired">().notNull(),
		replacements: jsonb().$type<string[]>().notNull(),
	},
	(t) => [
		unique("schema_definition_term_id").on(t.id, t.termId),
		unique("schema_definition_origin").on(t.id, t.termId, t.vocabularyId),
		unique("schema_definition_content").on(t.termId, t.vocabularyId, t.digest),
		check(
			"schema_definition_shape",
			sql`${t.digest} ~ '^[0-9a-f]{64}$' and ${t.status} in ('active','pending','retired') and jsonb_typeof(${t.types}) = 'array' and jsonb_typeof(${t.replacements}) = 'array'`,
		),
	],
);

/** @alpha Release membership selects an exact upstream definition without rewriting other releases. */
export const schemaReleaseTerm = pgTable(
	"schema_release_term",
	{
		releaseId: uuid("release_id").notNull(),
		vocabularyId: uuid("vocabulary_id").notNull(),
		termId: uuid("term_id").notNull(),
		definitionId: uuid("definition_id").notNull(),
	},
	(t) => [
		primaryKey({ columns: [t.releaseId, t.termId] }),
		foreignKey({
			columns: [t.releaseId, t.vocabularyId],
			foreignColumns: [schemaRelease.id, schemaRelease.vocabularyId],
		}),
		foreignKey({
			columns: [t.definitionId, t.termId, t.vocabularyId],
			foreignColumns: [schemaDefinition.id, schemaDefinition.termId, schemaDefinition.vocabularyId],
		}),
		index("schema_release_term_reverse").on(t.termId, t.releaseId),
	],
);

/** @alpha One literal label can be reused by releases; its lexical form and language remain intact. */
export const schemaLabel = pgTable(
	"schema_label",
	{
		id: uuid().primaryKey(),
		termId: uuid("term_id")
			.notNull()
			.references(() => schemaTerm.id),
		predicate: text().notNull(),
		value: text().notNull(),
		language: text().notNull(),
		datatype: text().notNull(),
	},
	(t) => [
		unique("schema_label_term_language").on(t.id, t.termId, t.language),
		unique("schema_label_term").on(t.id, t.termId),
		index("schema_label_locale").on(t.termId, t.language, t.id),
	],
);

/** @alpha Imported labels preserve all upstream alternatives instead of arbitrarily choosing a winner. */
export const schemaReleaseLabel = pgTable(
	"schema_release_label",
	{
		releaseId: uuid("release_id").notNull(),
		termId: uuid("term_id").notNull(),
		labelId: uuid("label_id").notNull(),
	},
	(t) => [
		primaryKey({ columns: [t.releaseId, t.termId, t.labelId] }),
		foreignKey({
			columns: [t.releaseId, t.termId],
			foreignColumns: [schemaReleaseTerm.releaseId, schemaReleaseTerm.termId],
		}),
		foreignKey({
			columns: [t.labelId, t.termId],
			foreignColumns: [schemaLabel.id, schemaLabel.termId],
		}),
	],
);

/** @alpha Shared edit identity; source, review and AI annotations can reference this same logical object. */
export const schemaChange = pgTable(
	"schema_change",
	{
		id: uuid().primaryKey(),
		actor: jsonb().$type<{ owner: string; id: string } | null>(),
		message: text().notNull(),
		createdAt: createdAt(),
	},
	(t) => [
		check("schema_change_message_bound", sql`octet_length(${t.message}) between 1 and 16384`),
		check(
			"schema_change_actor",
			sql`${t.actor} is null or coalesce(jsonb_typeof(${t.actor}) = 'object' and ${t.actor}->>'owner' ~ '^[a-z][a-z0-9_.-]{0,95}$' and ${t.actor}->>'id' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$', false)`,
		),
	],
);

/** @alpha Translation adoption has its own append-only history and never creates a meaning revision. */
export const schemaLabelSelection = pgTable(
	"schema_label_selection",
	{
		id: uuid().primaryKey(),
		termId: uuid("term_id")
			.notNull()
			.references(() => schemaTerm.id),
		language: text().notNull(),
		labelId: uuid("label_id").notNull(),
		version: version(),
		changeId: uuid("change_id")
			.notNull()
			.references(() => schemaChange.id),
		createdAt: createdAt(),
	},
	(t) => [
		foreignKey({
			columns: [t.labelId, t.termId, t.language],
			foreignColumns: [schemaLabel.id, schemaLabel.termId, schemaLabel.language],
		}),
		unique("schema_label_selection_version").on(t.termId, t.language, t.version),
		index("schema_label_selection_latest").on(t.termId, t.language, t.version.desc()),
		check(
			"schema_label_selection_version_positive",
			sql`${t.version} between 1 and 9007199254740991`,
		),
	],
);

/** @alpha Product profiles have an identity separate from the external terms they constrain. */
export const schemaProfile = pgTable(
	"schema_profile",
	{
		id: uuid().primaryKey(),
		key: text().notNull(),
	},
	(t) => [unique("schema_profile_key").on(t.key)],
);

/** @alpha Profiles pin exact interpretation; changing a rule creates a new immutable revision. */
export const schemaProfileRevision = pgTable(
	"schema_profile_revision",
	{
		id: uuid().primaryKey(),
		profileId: uuid("profile_id")
			.notNull()
			.references(() => schemaProfile.id),
		digest: text().notNull(),
		body: jsonb().$type<ApplicationProfile>().notNull(),
	},
	(t) => [
		unique("schema_profile_revision_digest").on(t.profileId, t.digest),
		check("schema_profile_revision_body", sql`jsonb_typeof(${t.body}) = 'object'`),
	],
);

/** @alpha Indexed profile dependencies enforce that a rule's predicate and definition agree. */
export const schemaProfileRule = pgTable(
	"schema_profile_rule",
	{
		profileRevisionId: uuid("profile_revision_id")
			.notNull()
			.references(() => schemaProfileRevision.id),
		predicateId: uuid("predicate_id").notNull(),
		definitionId: uuid("definition_id").notNull(),
	},
	(t) => [
		primaryKey({ columns: [t.profileRevisionId, t.predicateId] }),
		foreignKey({
			columns: [t.definitionId, t.predicateId],
			foreignColumns: [schemaDefinition.id, schemaDefinition.termId],
		}),
	],
);

/**
 * @alpha A reusable relation family without a universal content parent.
 * @remarks Choose a physical family per workload. Logical owner/UUID addresses and portable records stay stable.
 */
export function defineRelationTables(prefix: string) {
	if (!/^[a-z][a-z0-9_]{0,30}$/u.test(prefix)) throw new TypeError("Invalid relation table prefix");
	const relation = pgTable(
		`${prefix}_relation`,
		{
			id: uuid().primaryKey(),
			subjectOwner: text("subject_owner").notNull(),
			subjectId: uuid("subject_id").notNull(),
			createdAt: createdAt(),
		},
		(t) => [
			index(`${prefix}_relation_subject`).on(t.subjectOwner, t.subjectId, t.id),
			check(`${prefix}_relation_owner`, sql`${t.subjectOwner} ~ '^[a-z][a-z0-9_.-]{0,95}$'`),
		],
	);
	const revision = pgTable(
		`${prefix}_relation_revision`,
		{
			id: uuid().primaryKey(),
			relationId: uuid("relation_id")
				.notNull()
				.references(() => relation.id),
			predicateId: uuid("predicate_id").notNull(),
			definitionId: uuid("definition_id").notNull(),
			subjectRevisionId: uuid("subject_revision_id"),
			parentRevisionId: uuid("parent_revision_id"),
			changeId: uuid("change_id")
				.notNull()
				.references(() => schemaChange.id),
			value: jsonb().$type<SemanticValue>().notNull(),
			position: numeric(),
			digest: text().notNull(),
			createdAt: createdAt(),
		},
		(t) => [
			unique(`${prefix}_revision_relation`).on(t.id, t.relationId),
			foreignKey({
				columns: [t.definitionId, t.predicateId],
				foreignColumns: [schemaDefinition.id, schemaDefinition.termId],
			}),
			foreignKey({
				columns: [t.parentRevisionId, t.relationId],
				foreignColumns: [t.id, t.relationId],
			}),
			index(`${prefix}_revision_history`).on(t.relationId, t.createdAt, t.id),
			index(`${prefix}_revision_predicate`).on(t.predicateId, t.relationId, t.id),
			index(`${prefix}_revision_target`)
				.on(
					sql`(${t.value}->'reference'->>'owner')`,
					sql`(${t.value}->'reference'->>'id')`,
					t.predicateId,
					t.id,
				)
				.where(sql`${t.value}->>'kind' = 'reference'`),
			check(
				`${prefix}_revision_shape`,
				sql`${t.digest} ~ '^[0-9a-f]{64}$' and (${t.position} is null or (${t.position} >= 0 and ${t.position} < 1e40 and scale(${t.position}) = 0)) and jsonb_typeof(${t.value}) = 'object' and ${t.value}->>'kind' in ('reference','iri','literal','unknown','no-value')`,
			),
			check(
				`${prefix}_revision_not_self_parent`,
				sql`${t.parentRevisionId} is null or ${t.parentRevisionId} <> ${t.id}`,
			),
			check(
				`${prefix}_revision_value`,
				sql`coalesce(octet_length(${t.value}::text) <= 524288 and case ${t.value}->>'kind'
			when 'reference' then jsonb_typeof(${t.value}->'reference') = 'object'
				and ${t.value}->'reference'->>'owner' ~ '^[a-z][a-z0-9_.-]{0,95}$'
				and ${t.value}->'reference'->>'id' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
				and (not (${t.value}->'reference' ? 'revisionId') or ${t.value}->'reference'->>'revisionId' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
			when 'iri' then jsonb_typeof(${t.value}->'iri') = 'string' and ${t.value}->>'iri' ~ '^[A-Za-z][A-Za-z0-9+.-]*:'
			when 'literal' then jsonb_typeof(${t.value}->'value') = 'string' and jsonb_typeof(${t.value}->'datatype') = 'string'
				and ${t.value}->>'datatype' ~ '^[A-Za-z][A-Za-z0-9+.-]*:'
				and (${t.value}->>'datatype' = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#langString') = (${t.value} ? 'language')
				and (not (${t.value} ? 'language') or ${t.value}->>'language' ~* '^[a-z]+(-[a-z0-9]+)*$')
			when 'unknown' then true when 'no-value' then true else false end, false)`,
			),
		],
	);
	const selection = pgTable(
		`${prefix}_relation_selection`,
		{
			id: uuid().primaryKey(),
			relationId: uuid("relation_id")
				.notNull()
				.references(() => relation.id),
			revisionId: uuid("revision_id"),
			version: version(),
			changeId: uuid("change_id")
				.notNull()
				.references(() => schemaChange.id),
			createdAt: createdAt(),
		},
		(t) => [
			foreignKey({
				columns: [t.revisionId, t.relationId],
				foreignColumns: [revision.id, revision.relationId],
			}),
			unique(`${prefix}_selection_version`).on(t.relationId, t.version),
			index(`${prefix}_selection_latest`).on(t.relationId, t.version.desc()),
			check(
				`${prefix}_selection_version_positive`,
				sql`${t.version} between 1 and 9007199254740991`,
			),
		],
	);
	return { relation, revision, selection };
}

const defaultRelations = defineRelationTables("schema");
/** @alpha Default family for schema-focused tools; content services can instantiate separate families. */
export const schemaRelation = defaultRelations.relation;
/** @alpha Exact assertion revisions can themselves receive references, reviews and annotations. */
export const schemaRelationRevision = defaultRelations.revision;
/** @alpha Adoption is separate from revision creation; a null selection explicitly retracts a relation. */
export const schemaRelationSelection = defaultRelations.selection;
