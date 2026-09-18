import { sql } from "drizzle-orm";
import {
	check,
	foreignKey,
	index,
	jsonb,
	pgTable,
	primaryKey,
	text,
	unique,
	uuid,
} from "drizzle-orm/pg-core";
import { schemaRelease, schemaReleaseTerm, schemaTerm } from "./registry.generated";
import { catalogDefinitionRevision } from "../catalog/identity";

/** @alpha Complete RDF node identity; blank nodes and graphs are scoped to one immutable release. */
export const schemaNode = pgTable(
	"schema_node",
	{
		releaseId: uuid("release_id")
			.notNull()
			.references(() => schemaRelease.id),
		id: uuid().notNull(),
		kind: text().$type<"iri" | "blank" | "literal" | "default-graph">().notNull(),
		termId: uuid("term_id").references(() => schemaTerm.id),
		lexical: text().notNull(),
		datatypeId: uuid("datatype_id").references(() => schemaTerm.id),
		language: text(),
	},
	(t) => [
		primaryKey({ columns: [t.releaseId, t.id] }),
		index("schema_node_term_idx").on(t.termId, t.releaseId, t.id),
		check(
			"schema_node_kind_check",
			sql`(${t.kind}='iri' and ${t.termId} is not null and ${t.datatypeId} is null and ${t.language} is null)
 or (${t.kind}='blank' and ${t.termId} is null and ${t.datatypeId} is null and ${t.language} is null)
 or (${t.kind}='literal' and ${t.termId} is null and ${t.datatypeId} is not null)
 or (${t.kind}='default-graph' and ${t.lexical}='' and num_nonnulls(${t.termId},${t.datatypeId},${t.language})=0)`,
		),
	],
);

/** @alpha Queryable ontology statements retain every predicate, graph, list link and unknown axiom. */
export const schemaStatement = pgTable(
	"schema_statement",
	{
		releaseId: uuid("release_id")
			.notNull()
			.references(() => schemaRelease.id),
		id: uuid().notNull(),
		subjectId: uuid("subject_id").notNull(),
		predicateId: uuid("predicate_id")
			.notNull()
			.references(() => schemaTerm.id),
		predicateIri: text("predicate_iri").notNull(),
		predicateIriHash: text("predicate_iri_hash").notNull(),
		objectId: uuid("object_id").notNull(),
		graphId: uuid("graph_id").notNull(),
	},
	(t) => [
		primaryKey({ columns: [t.releaseId, t.id] }),
		...[t.subjectId, t.objectId, t.graphId].map((column) =>
			foreignKey({
				columns: [t.releaseId, column],
				foreignColumns: [schemaNode.releaseId, schemaNode.id],
			}),
		),
		check(
			"schema_statement_predicate_hash",
			sql`encode(sha256(convert_to(${t.predicateIri},'UTF8')),'hex')=${t.predicateIriHash}`,
		),
		unique("schema_statement_quad_key").on(
			t.releaseId,
			t.subjectId,
			t.predicateIriHash,
			t.objectId,
			t.graphId,
		),
		index("schema_statement_subject_idx").on(t.releaseId, t.subjectId, t.predicateId, t.id),
		index("schema_statement_reverse_idx").on(t.releaseId, t.predicateId, t.objectId, t.id),
	],
);

/** @alpha Native operational constraints bind to an exact standard meaning without duplicating semantic identity. */
export const catalogDefinitionBinding = pgTable(
	"catalog_definition_binding",
	{
		definitionRevisionId: uuid("definition_revision_id")
			.primaryKey()
			.references(() => catalogDefinitionRevision.id),
		termId: uuid("term_id")
			.notNull()
			.references(() => schemaTerm.id),
		releaseId: uuid("release_id")
			.notNull()
			.references(() => schemaRelease.id),
		relation: text().$type<"exact" | "specialization" | "transformation">().notNull(),
		contract: jsonb().$type<Record<string, unknown>>().notNull(),
	},
	(t) => [
		foreignKey({
			columns: [t.releaseId, t.termId],
			foreignColumns: [schemaReleaseTerm.releaseId, schemaReleaseTerm.termId],
		}),
		index("catalog_definition_binding_term_idx").on(t.termId, t.definitionRevisionId),
		check(
			"catalog_definition_binding_relation_check",
			sql`${t.relation} in ('exact','specialization','transformation') and jsonb_typeof(${t.contract})='object'`,
		),
	],
);
