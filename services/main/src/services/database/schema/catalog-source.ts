import { inArray, sql } from "drizzle-orm";
import {
	bigint,
	check,
	foreignKey,
	index,
	primaryKey,
	text,
	unique,
	uuid,
} from "drizzle-orm/pg-core";
import { pgTable } from "./base";
import { createCreatedAtColumn, createUuidv7PrimaryKey } from "./columns";
import { CatalogOwnerValues, type CatalogOwner } from "../../catalog/contracts";
import { users } from "./auth";

/** Upstream record identity; it does not allocate a native Unit or grant participation. */
export const catalogSourceRecord = pgTable(
	"catalog_source_record",
	{
		id: createUuidv7PrimaryKey(),
		source: text().notNull(),
		objectType: text().notNull(),
		externalId: text().notNull(),
	},
	(table) => [
		unique("catalog_source_record_native_key").on(table.source, table.objectType, table.externalId),
		check(
			"catalog_source_record_key_check",
			sql`octet_length(${table.source}) between 1 and 96 and octet_length(${table.objectType}) between 1 and 96 and octet_length(${table.externalId}) between 1 and 512`,
		),
	],
);

/** Immutable acquisition evidence shared by bindings; large payloads live outside OLTP. */
export const catalogSourceSnapshot = pgTable(
	"catalog_source_snapshot",
	{
		sourceRecordId: uuid()
			.notNull()
			.references(() => catalogSourceRecord.id, { onDelete: "restrict" }),
		id: uuid().default(sql`uuidv7()`).notNull(),
		contentSha256: text().notNull(),
		contractSha256: text().notNull(),
		payloadRef: text().notNull(),
		sourceRevision: text(),
		observedAt: createCreatedAtColumn(),
	},
	(table) => [
		primaryKey({ columns: [table.sourceRecordId, table.id] }),
		index("catalog_source_snapshot_record_time_idx").on(
			table.sourceRecordId,
			table.observedAt,
			table.id,
		),
		check(
			"catalog_source_snapshot_content_hash_check",
			sql`${table.contentSha256} ~ '^[a-f0-9]{64}$' and ${table.contractSha256} ~ '^[a-f0-9]{64}$'`,
		),
		check("catalog_source_snapshot_payload_ref_check", sql`length(${table.payloadRef}) > 0`),
	],
);

/** Exact source key and path ownership prevents concurrent importers allocating twice. */
export const catalogSourceMappingClaim = pgTable(
	"catalog_source_mapping_claim",
	{
		sourceRecordId: uuid()
			.notNull()
			.references(() => catalogSourceRecord.id, { onDelete: "restrict" }),
		path: text().notNull(),
		/** Mapper protocol identity; native targets are validated in the owner binding. */
		mappingKey: uuid().default(sql`uuidv7()`).notNull(),
		owner: text().$type<CatalogOwner>().notNull(),
		observedSnapshotId: uuid(),
		evidenceSourceRecordId: uuid(),
		evidenceSnapshotId: uuid(),
		evidencePath: text(),
	},
	(table) => [
		primaryKey({ columns: [table.sourceRecordId, table.path] }),
		unique("catalog_source_mapping_claim_owner_key").on(table.mappingKey, table.owner),
		unique("catalog_source_mapping_claim_record_key").on(
			table.sourceRecordId,
			table.mappingKey,
			table.owner,
		),
		foreignKey({
			name: "catalog_source_mapping_claim_snapshot_fk",
			columns: [table.sourceRecordId, table.observedSnapshotId],
			foreignColumns: [catalogSourceSnapshot.sourceRecordId, catalogSourceSnapshot.id],
		}).onDelete("restrict"),
		foreignKey({
			name: "catalog_source_mapping_reference_evidence_fk",
			columns: [table.evidenceSourceRecordId, table.evidenceSnapshotId],
			foreignColumns: [catalogSourceSnapshot.sourceRecordId, catalogSourceSnapshot.id],
		}).onDelete("restrict"),
		index("catalog_source_mapping_reference_evidence_idx").on(
			table.evidenceSourceRecordId,
			table.evidenceSnapshotId,
		),
		check(
			"catalog_source_mapping_evidence_check",
			sql`(${table.observedSnapshotId} is not null and ${table.evidenceSourceRecordId} is null and ${table.evidenceSnapshotId} is null and ${table.evidencePath} is null) or (${table.observedSnapshotId} is null and ${table.evidenceSourceRecordId} is not null and ${table.evidenceSnapshotId} is not null and ${table.evidencePath} is not null and octet_length(${table.evidencePath}) between 1 and 512)`,
		),
		index("catalog_source_mapping_claim_snapshot_idx").on(
			table.sourceRecordId,
			table.observedSnapshotId,
		),
		check(
			"catalog_source_mapping_claim_path_check",
			sql`octet_length(${table.path}) between 1 and 512`,
		),
		check("catalog_source_mapping_claim_owner_check", inArray(table.owner, CatalogOwnerValues)),
	],
);

/** A changed source snapshot is review work, not permission to overwrite local edits. */
export const catalogSourceAdoptionProposal = pgTable(
	"catalog_source_adoption_proposal",
	{
		sourceRecordId: uuid().notNull(),
		id: uuid().default(sql`uuidv7()`).notNull(),
		snapshotId: uuid().notNull(),
		mappingKey: uuid().notNull(),
		mappingOwner: text().$type<CatalogOwner>().notNull(),
		mappingVersion: text().notNull(),
		expectedTargetRevision: bigint({ mode: "number" }).notNull(),
		proposerAuthUserId: uuid().references(() => users.id, { onDelete: "set null" }),
		state: text()
			.$type<"pending" | "applied" | "rejected" | "superseded">()
			.default("pending")
			.notNull(),
		createdAt: createCreatedAtColumn(),
	},
	(table) => [
		primaryKey({ columns: [table.sourceRecordId, table.id] }),
		unique("catalog_adoption_snapshot_mapping_key").on(
			table.sourceRecordId,
			table.snapshotId,
			table.mappingKey,
			table.mappingVersion,
		),
		foreignKey({
			name: "catalog_adoption_snapshot_fk",
			columns: [table.sourceRecordId, table.snapshotId],
			foreignColumns: [catalogSourceSnapshot.sourceRecordId, catalogSourceSnapshot.id],
		}).onDelete("restrict"),
		foreignKey({
			name: "catalog_adoption_mapping_fk",
			columns: [table.sourceRecordId, table.mappingKey, table.mappingOwner],
			foreignColumns: [
				catalogSourceMappingClaim.sourceRecordId,
				catalogSourceMappingClaim.mappingKey,
				catalogSourceMappingClaim.owner,
			],
		}).onDelete("restrict"),
		index("catalog_adoption_pending_idx").on(
			table.state,
			table.createdAt,
			table.sourceRecordId,
			table.id,
		),
		index("catalog_adoption_mapping_idx").on(
			table.mappingKey,
			table.mappingOwner,
			table.sourceRecordId,
			table.id,
		),
		index("catalog_adoption_proposer_idx").on(
			table.proposerAuthUserId,
			table.sourceRecordId,
			table.id,
		),
		check("catalog_adoption_owner_check", inArray(table.mappingOwner, CatalogOwnerValues)),
		check(
			"catalog_adoption_revision_check",
			sql`${table.expectedTargetRevision} between 1 and 9007199254740991`,
		),
		check(
			"catalog_adoption_state_check",
			sql`${table.state} in ('pending', 'applied', 'rejected', 'superseded')`,
		),
		check(
			"catalog_adoption_version_check",
			sql`octet_length(${table.mappingVersion}) between 1 and 128`,
		),
	],
);
