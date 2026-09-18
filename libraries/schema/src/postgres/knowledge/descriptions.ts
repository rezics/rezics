import { sql } from "drizzle-orm";
import {
	bigint,
	check,
	foreignKey,
	index,
	jsonb,
	primaryKey,
	text,
	timestamp,
	unique,
	uuid,
} from "drizzle-orm/pg-core";
import { pgTable } from "../shared/base";
import { schemaTerm } from "../vocabulary/registry";
import { users } from "../identity/auth";
import { referenceValue } from "./reference-value";
import { mediaBlob } from "../media/indexing";

/** @alpha Source-free descriptions cover standard classes without inventing a universal parent for other owners. */
export const descriptionObject = pgTable(
	"description_object",
	{
		id: uuid().primaryKey(),
		createdAt: timestamp({ withTimezone: true, precision: 3 }).defaultNow().notNull(),
		visibility: text().notNull(),
		state: text().notNull(),
		controlRevision: bigint({ mode: "number" }).default(1).notNull(),
	},
	(t) => [
		check(
			"description_object_state",
			sql`${t.visibility} in ('public','unlisted','private') and ${t.state} in ('draft','published','withdrawn','erased') and ${t.controlRevision}>0`,
		),
	],
);
export const descriptionChange = pgTable(
	"description_change",
	{
		id: uuid().primaryKey(),
		objectId: uuid()
			.notNull()
			.references(() => descriptionObject.id),
		actorUserId: uuid().references(() => users.id),
		nonce: text().notNull(),
		payloadDigest: text().notNull(),
		summary: text(),
		createdAt: timestamp({ withTimezone: true, precision: 3 }).defaultNow().notNull(),
	},
	(t) => [
		unique("description_change_scope").on(t.id, t.objectId),
		unique("description_change_receipt").on(t.objectId, t.nonce),
	],
);
export const descriptionRevision = pgTable(
	"description_revision",
	{
		objectId: uuid()
			.notNull()
			.references(() => descriptionObject.id),
		id: uuid().notNull(),
		parentId: uuid(),
		changeId: uuid().notNull(),
		payloadState: text().notNull().default("available"),
		createdAt: timestamp({ withTimezone: true, precision: 3 }).defaultNow().notNull(),
	},
	(t) => [
		primaryKey({ columns: [t.objectId, t.id] }),
		foreignKey({ columns: [t.objectId, t.parentId], foreignColumns: [t.objectId, t.id] }),
		foreignKey({
			columns: [t.changeId, t.objectId],
			foreignColumns: [descriptionChange.id, descriptionChange.objectId],
		}),
		check("description_revision_payload", sql`${t.payloadState} in ('available','erased')`),
	],
);
export const descriptionType = pgTable(
	"description_type",
	{
		objectId: uuid().notNull(),
		revisionId: uuid().notNull(),
		typeId: uuid()
			.notNull()
			.references(() => schemaTerm.id),
	},
	(t) => [
		primaryKey({ columns: [t.objectId, t.revisionId, t.typeId] }),
		foreignKey({
			columns: [t.objectId, t.revisionId],
			foreignColumns: [descriptionRevision.objectId, descriptionRevision.id],
		}),
		index("description_type_reverse").on(t.typeId, t.objectId, t.revisionId),
	],
);
export const descriptionStatement = pgTable(
	"description_statement",
	{
		objectId: uuid().notNull(),
		revisionId: uuid().notNull(),
		id: uuid().notNull(),
		predicateId: uuid()
			.notNull()
			.references(() => schemaTerm.id),
		state: text().notNull(),
		datatypeId: uuid().references(() => schemaTerm.id),
		lexical: text(),
		language: text(),
		valueHash: text(),
		nativeTargetRefId: uuid().references(() => referenceValue.id),
		descriptionTargetId: uuid().references(() => descriptionObject.id),
		externalIri: text(),
		orderKey: text(),
	},
	(t) => [
		primaryKey({ columns: [t.objectId, t.revisionId, t.id] }),
		foreignKey({
			columns: [t.objectId, t.revisionId],
			foreignColumns: [descriptionRevision.objectId, descriptionRevision.id],
		}),
		index("description_statement_predicate").on(t.predicateId, t.objectId, t.revisionId, t.id),
		index("description_statement_literal").on(t.predicateId, t.datatypeId, t.valueHash, t.objectId),
		index("description_statement_native_reverse").on(
			t.nativeTargetRefId,
			t.predicateId,
			t.objectId,
		),
		index("description_statement_description_reverse").on(
			t.descriptionTargetId,
			t.predicateId,
			t.objectId,
		),
		check(
			"description_statement_value",
			sql`(${t.state}='literal' and ${t.datatypeId} is not null and ${t.lexical} is not null and ${t.valueHash} is not null and num_nonnulls(${t.nativeTargetRefId},${t.descriptionTargetId},${t.externalIri})=0)
 or (${t.state}='reference' and num_nonnulls(${t.nativeTargetRefId},${t.descriptionTargetId},${t.externalIri})=1 and num_nonnulls(${t.datatypeId},${t.lexical},${t.language},${t.valueHash})=0)
 or (${t.state} in ('unknown','no-value') and num_nonnulls(${t.nativeTargetRefId},${t.descriptionTargetId},${t.externalIri},${t.datatypeId},${t.lexical},${t.language},${t.valueHash})=0)`,
		),
	],
);
export const descriptionEvidence = pgTable(
	"description_evidence",
	{
		objectId: uuid().notNull(),
		revisionId: uuid().notNull(),
		statementId: uuid().notNull(),
		id: uuid().notNull(),
		sourceUri: text(),
		snapshotBlobId: uuid().references(() => mediaBlob.id),
		selector: jsonb().$type<Record<string, unknown>>(),
	},
	(t) => [
		primaryKey({ columns: [t.objectId, t.revisionId, t.statementId, t.id] }),
		foreignKey({
			columns: [t.objectId, t.revisionId, t.statementId],
			foreignColumns: [
				descriptionStatement.objectId,
				descriptionStatement.revisionId,
				descriptionStatement.id,
			],
		}),
		check(
			"description_evidence_reference",
			sql`num_nonnulls(${t.sourceUri},${t.snapshotBlobId})>0`,
		),
	],
);
export const descriptionSelection = pgTable(
	"description_selection",
	{
		objectId: uuid()
			.primaryKey()
			.references(() => descriptionObject.id),
		revisionId: uuid().notNull(),
		version: bigint({ mode: "number" }).notNull(),
		changeId: uuid().notNull(),
	},
	(t) => [
		foreignKey({
			columns: [t.objectId, t.revisionId],
			foreignColumns: [descriptionRevision.objectId, descriptionRevision.id],
		}),
		foreignKey({
			columns: [t.changeId, t.objectId],
			foreignColumns: [descriptionChange.id, descriptionChange.objectId],
		}),
		check("description_selection_version", sql`${t.version}>0`),
	],
);

/** @alpha Assessment refers to an exact assertion; machine confidence and human acceptance remain distinct. */
export const assertionAssessment = pgTable(
	"assertion_assessment",
	{
		id: uuid().primaryKey(),
		objectId: uuid().notNull(),
		revisionId: uuid().notNull(),
		statementId: uuid().notNull(),
		issuerUserId: uuid().references(() => users.id),
		methodIri: text().notNull(),
		methodVersion: text().notNull(),
		verdict: text().notNull(),
		evidenceDigest: text().notNull(),
		createdAt: timestamp({ withTimezone: true, precision: 3 }).defaultNow().notNull(),
	},
	(t) => [
		foreignKey({
			columns: [t.objectId, t.revisionId, t.statementId],
			foreignColumns: [
				descriptionStatement.objectId,
				descriptionStatement.revisionId,
				descriptionStatement.id,
			],
		}),
		check(
			"assertion_assessment_verdict",
			sql`${t.verdict} in ('supported','refuted','disputed','abstained','unavailable')`,
		),
		index("assertion_assessment_target").on(t.objectId, t.revisionId, t.statementId, t.id),
	],
);
