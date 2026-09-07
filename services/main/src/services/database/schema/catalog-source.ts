import { inArray, sql } from "drizzle-orm";
import {
	bigint,
	check,
	foreignKey,
	index,
	primaryKey,
	integer,
	boolean,
	timestamp,
	text,
	unique,
	uuid,
} from "drizzle-orm/pg-core";
import { pgTable } from "./base";
import { createCreatedAtColumn } from "./columns";
import { CatalogOwnerValues, type CatalogOwner } from "../../catalog/contracts";
import { users } from "./auth";
import { CatalogIdentityTables } from "./catalog-identity";

/** Three configured provider budgets, independent of corpus cardinality and worker replicas. */
export const catalogSourceProviderBudget = pgTable(
	"catalog_source_provider_budget",
	{
		source: text().primaryKey(),
		enabled: boolean().default(true).notNull(),
		minimumIntervalMs: integer().default(1100).notNull(),
		nextAllowedAt: timestamp({ withTimezone: true, precision: 3 }).defaultNow().notNull(),
	},
	(table) => [
		check(
			"catalog_source_provider_budget_check",
			sql`${table.source} in ('musicbrainz','vndb','bangumi') and ${table.minimumIntervalMs} between 1000 and 86400000`,
		),
	],
);

/** Upstream record identity; it does not allocate a native Unit or grant participation. */
export const catalogSourceRecord = pgTable(
	"catalog_source_record",
	{
		id: uuid().primaryKey(),
		source: text().notNull(),
		objectType: text().notNull(),
		externalId: text().notNull(),
		acquisitionGeneration: bigint({ mode: "number" }).default(0).notNull(),
		acceptedGeneration: bigint({ mode: "number" }).default(0).notNull(),
		headSnapshotId: uuid(),
		lastCheckedAt: timestamp({ withTimezone: true, precision: 3 }),
		lastCheckOutcome: text().$type<"changed" | "unchanged" | "error" | "tombstone">(),
	},
	(table) => [
		// Deterministic natural-key routing lets the primary key enforce uniqueness across shards.
		check(
			"catalog_source_record_identity_check",
			sql`replace(${table.id}::text, '-', '') = overlay(overlay(substr(encode(sha256(convert_to(${table.source} || chr(10) || ${table.objectType} || chr(10) || ${table.externalId}, 'UTF8')), 'hex'), 1, 32) placing '8' from 13 for 1) placing '8' from 17 for 1)`,
		),
		check(
			"catalog_source_record_namespace_check",
			sql`${table.source} ~ '^[a-z][a-z0-9_.-]{0,95}$' and ${table.objectType} ~ '^[a-z][a-z0-9_.-]{0,95}$'`,
		),
		check(
			"catalog_source_record_generation_check",
			sql`${table.acceptedGeneration} between 0 and ${table.acquisitionGeneration} and ${table.acquisitionGeneration} <= 9007199254740991`,
		),
		check(
			"catalog_source_record_outcome_check",
			sql`${table.lastCheckOutcome} is null or ${table.lastCheckOutcome} in ('changed','unchanged','error','tombstone')`,
		),
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
		bindingRevision: bigint({ mode: "number" }).default(1).notNull(),
		policyRevision: bigint({ mode: "number" }).default(1).notNull(),
		state: text().$type<"active" | "paused" | "withdrawn">().default("active").notNull(),
		baselineTargetRevision: bigint({ mode: "number" }),
		mappingVersion: text().default("source.manual.1").notNull(),
	},
	(table) => [
		primaryKey({ columns: [table.sourceRecordId, table.path] }),
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
		expectedBindingRevision: bigint({ mode: "number" }).default(1).notNull(),
		expectedPolicyRevision: bigint({ mode: "number" }).default(1).notNull(),
		decidedAt: timestamp({ withTimezone: true, precision: 3 }),
		decisionReason: text(),
		appliedTargetRevision: bigint({ mode: "number" }),
		proposerAuthUserId: uuid().references(() => users.id, { onDelete: "set null" }),
		state: text()
			.$type<"pending" | "applied" | "rejected" | "superseded" | "withdrawn">()
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
			table.expectedBindingRevision,
			table.expectedPolicyRevision,
			table.expectedTargetRevision,
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
			sql`${table.state} in ('pending', 'applied', 'rejected', 'superseded', 'withdrawn')`,
		),
		check(
			"catalog_adoption_version_check",
			sql`octet_length(${table.mappingVersion}) between 1 and 128`,
		),
	],
);

/** Immutable decisions retain exact native FK alternatives even after a rebind. */
export const catalogSourceBindingRevision = pgTable(
	"catalog_source_binding_revision",
	{
		sourceRecordId: uuid().notNull(),
		mappingKey: uuid().notNull(),
		owner: text().$type<CatalogOwner>().notNull(),
		revision: bigint({ mode: "number" }).notNull(),
		policyRevision: bigint({ mode: "number" }).notNull(),
		mappingVersion: text().notNull(),
		state: text().$type<"active" | "paused" | "withdrawn">().notNull(),
		mode: text().$type<"review" | "manual">().notNull(),
		publishingId: uuid().references(() => CatalogIdentityTables.publishing.id, {
			onDelete: "restrict",
		}),
		musicId: uuid().references(() => CatalogIdentityTables.music.id, { onDelete: "restrict" }),
		programId: uuid().references(() => CatalogIdentityTables.program.id, { onDelete: "restrict" }),
		softwareId: uuid().references(() => CatalogIdentityTables.software.id, {
			onDelete: "restrict",
		}),
		entityId: uuid().references(() => CatalogIdentityTables.entity.id, { onDelete: "restrict" }),
		groupingId: uuid().references(() => CatalogIdentityTables.grouping.id, {
			onDelete: "restrict",
		}),
		referenceId: uuid().references(() => CatalogIdentityTables.reference.id, {
			onDelete: "restrict",
		}),
		distributionId: uuid().references(() => CatalogIdentityTables.distribution.id, {
			onDelete: "restrict",
		}),
		actorAuthUserId: uuid()
			.notNull()
			.references(() => users.id, { onDelete: "restrict" }),
		createdAt: createCreatedAtColumn(),
		reason: text().notNull(),
	},
	(table) => [
		primaryKey({ columns: [table.sourceRecordId, table.mappingKey, table.revision] }),
		foreignKey({
			columns: [table.sourceRecordId, table.mappingKey, table.owner],
			foreignColumns: [
				catalogSourceMappingClaim.sourceRecordId,
				catalogSourceMappingClaim.mappingKey,
				catalogSourceMappingClaim.owner,
			],
		}).onDelete("restrict"),
		check(
			"catalog_source_binding_revision_target_check",
			sql`num_nonnulls(${table.publishingId}, ${table.musicId}, ${table.programId}, ${table.softwareId}, ${table.entityId}, ${table.groupingId}, ${table.referenceId}, ${table.distributionId}) = 1 and case ${table.owner} when 'publishing' then ${table.publishingId} when 'music' then ${table.musicId} when 'program' then ${table.programId} when 'software' then ${table.softwareId} when 'entity' then ${table.entityId} when 'grouping' then ${table.groupingId} when 'reference' then ${table.referenceId} when 'distribution' then ${table.distributionId} end is not null`,
		),
		check(
			"catalog_source_binding_revision_values_check",
			sql`${table.revision} between 1 and 9007199254740991 and ${table.policyRevision} between 1 and 9007199254740991 and ${table.state} in ('active','paused','withdrawn') and ${table.mode} in ('review','manual') and octet_length(${table.reason}) between 1 and 2048`,
		),
	],
);

/** One shared public acquisition plan; private transport scopes never share this relation. */
export const catalogSourceCheckPlan = pgTable(
	"catalog_source_check_plan",
	{
		sourceRecordId: uuid()
			.notNull()
			.references(() => catalogSourceRecord.id, { onDelete: "restrict" }),
		routingBucket: integer().notNull(),
		revision: bigint({ mode: "number" }).default(1).notNull(),
		nextCheckAt: timestamp({ withTimezone: true, precision: 3 }).notNull(),
		intervalSeconds: integer().notNull(),
		state: text().$type<"active" | "paused">().default("active").notNull(),
		leaseUntil: timestamp({ withTimezone: true, precision: 3 }),
	},
	(table) => [
		primaryKey({ columns: [table.routingBucket, table.sourceRecordId] }),
		check(
			"catalog_source_check_bucket_check",
			sql`${table.routingBucket} = (get_byte(sha256(convert_to('source_record:' || ${table.sourceRecordId}::text, 'UTF8')), 0) * 256 + get_byte(sha256(convert_to('source_record:' || ${table.sourceRecordId}::text, 'UTF8')), 1)) % 1024`,
		),
		index("catalog_source_check_due_idx").on(
			table.routingBucket,
			table.state,
			table.nextCheckAt,
			table.sourceRecordId,
		),
		check(
			"catalog_source_check_plan_limits",
			sql`${table.routingBucket} between 0 and 1023 and ${table.revision} between 1 and 9007199254740991 and ${table.intervalSeconds} between 60 and 2592000 and ${table.state} in ('active','paused')`,
		),
	],
);

/** Shared acquisition demand is scoped to a particular source binding and revision. */
export const catalogSourceSubscription = pgTable(
	"catalog_source_subscription",
	{
		sourceRecordId: uuid().notNull(),
		mappingKey: uuid().notNull(),
		owner: text().$type<CatalogOwner>().notNull(),
		revision: bigint({ mode: "number" }).default(1).notNull(),
		state: text().$type<"active" | "paused">().notNull(),
		updatedAt: createCreatedAtColumn(),
	},
	(table) => [
		primaryKey({ columns: [table.sourceRecordId, table.mappingKey] }),
		foreignKey({
			columns: [table.sourceRecordId, table.mappingKey, table.owner],
			foreignColumns: [
				catalogSourceMappingClaim.sourceRecordId,
				catalogSourceMappingClaim.mappingKey,
				catalogSourceMappingClaim.owner,
			],
		}).onDelete("restrict"),
		index("catalog_source_subscription_active_idx").on(
			table.sourceRecordId,
			table.state,
			table.mappingKey,
		),
		check(
			"catalog_source_subscription_values_check",
			sql`${table.revision} between 1 and 9007199254740991 and ${table.state} in ('active','paused')`,
		),
	],
);

/** Every completed check has a disposition; errors and missing partial pages are never tombstones. */
export const catalogSourceCheckReceipt = pgTable(
	"catalog_source_check_receipt",
	{
		sourceRecordId: uuid()
			.notNull()
			.references(() => catalogSourceRecord.id, { onDelete: "restrict" }),
		generation: bigint({ mode: "number" }).notNull(),
		outcome: text()
			.$type<"changed" | "unchanged" | "error" | "tombstone" | "superseded">()
			.notNull(),
		checkedAt: createCreatedAtColumn(),
		reason: text(),
	},
	(table) => [
		primaryKey({ columns: [table.sourceRecordId, table.generation] }),
		check(
			"catalog_source_check_receipt_values",
			sql`${table.generation} between 1 and 9007199254740991 and ${table.outcome} in ('changed','unchanged','error','tombstone','superseded') and (${table.reason} is null or octet_length(${table.reason}) <= 2048)`,
		),
	],
);

/** Durable snapshot fan-out cursor and receipts bound transaction work independently of target count. */
export const catalogSourceObservationFanout = pgTable(
	"catalog_source_observation_fanout",
	{
		sourceRecordId: uuid().notNull(),
		snapshotId: uuid().notNull(),
		afterMappingKey: uuid(),
		completedAt: timestamp({ withTimezone: true, precision: 3 }),
	},
	(table) => [
		primaryKey({ columns: [table.sourceRecordId, table.snapshotId] }),
		foreignKey({
			columns: [table.sourceRecordId, table.snapshotId],
			foreignColumns: [catalogSourceSnapshot.sourceRecordId, catalogSourceSnapshot.id],
		}).onDelete("restrict"),
	],
);
