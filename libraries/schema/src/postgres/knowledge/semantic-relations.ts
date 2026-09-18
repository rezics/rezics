import { sql } from "drizzle-orm";
import {
	bigint,
	check,
	foreignKey,
	index,
	jsonb,
	numeric,
	pgTable,
	text,
	timestamp,
	unique,
	uuid,
} from "drizzle-orm/pg-core";
import type { SemanticValue } from "../../contracts";
import { schemaChange, schemaDefinition } from "../vocabulary/registry";
const createdAt = () =>
	timestamp("created_at", { withTimezone: true, mode: "date", precision: 3 })
		.defaultNow()
		.notNull();
const version = () => bigint({ mode: "number" }).notNull();
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
