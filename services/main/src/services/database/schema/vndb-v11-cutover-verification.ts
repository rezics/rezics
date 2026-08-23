import { inArray, sql } from "drizzle-orm";
import { bigint, check, foreignKey, integer, primaryKey, text, uuid } from "drizzle-orm/pg-core";

import { pgTable } from "./base";
import { createCreatedAtColumn, createTimestampMsColumn, createUpdatedAtColumn } from "./columns";
import { vndbV11CutoverTransition } from "./vndb-v11-cutover";

export const VndbV11CutoverVerificationInitialChecksum = "0".repeat(64);
export const VndbV11CutoverVerificationContract = "vndb-v11-bounded-verifier-v1";

export const VndbV11CutoverVerificationRelationValues = [
	"unit_structure_primary_path_backfill",
	"unit_structure_primary_path_projection",
	"unit_tag_judgment_timestamps",
	"unit_structure_application_judgment_timestamps",
	"realm_tag_judgment_timestamps",
	"unit_tag_judgment_stat",
	"unit_structure_application_judgment_stat",
	"realm_tag_judgment_stat",
	"subject_association_judgment_stat",
] as const;

export type VndbV11CutoverVerificationRelation =
	(typeof VndbV11CutoverVerificationRelationValues)[number];

/**
 * Durable cursor for one bounded verification scan in one paused cutover epoch.
 *
 * The nine-row-per-epoch relation is operational control data rather than a
 * corpus relation. Canonical database triggers make completed rows immutable
 * and restrict unfinished updates to monotonic, exact-epoch progress.
 */
export const vndbV11CutoverVerificationCheckpoint = pgTable(
	"vndb_v11_cutover_verification_checkpoint",
	{
		transitionEpoch: bigint({ mode: "bigint" }).notNull(),
		relation: text().$type<VndbV11CutoverVerificationRelation>().notNull(),
		verificationContract: text().default(VndbV11CutoverVerificationContract).notNull(),
		cursor: text().array().default(sql`array[]::text[]`).notNull(),
		accumulatorKey: uuid().array().default(sql`array[]::uuid[]`).notNull(),
		accumulator: text().array().default(sql`array[]::text[]`).notNull(),
		scannedRowCount: bigint({ mode: "bigint" }).default(0n).notNull(),
		verifiedRowCount: bigint({ mode: "bigint" }).default(0n).notNull(),
		checksum: text().default(VndbV11CutoverVerificationInitialChecksum).notNull(),
		relationProof: text(),
		startedAt: createCreatedAtColumn(),
		completedAt: createTimestampMsColumn(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
		primaryKey({ columns: [table.transitionEpoch, table.relation] }),
		foreignKey({
			columns: [table.transitionEpoch],
			foreignColumns: [vndbV11CutoverTransition.transitionEpoch],
			name: "vndb_v11_cutover_verification_checkpoint_epoch_fkey",
		}).onDelete("restrict"),
		check(
			"vndb_v11_cutover_verification_checkpoint_epoch_check",
			sql`${table.transitionEpoch} > 0`,
		),
		check(
			"vndb_v11_cutover_verification_checkpoint_relation_check",
			inArray(table.relation, VndbV11CutoverVerificationRelationValues),
		),
		check(
			"vndb_v11_cutover_verification_checkpoint_contract_check",
			sql`${table.verificationContract} = ${VndbV11CutoverVerificationContract}`,
		),
		check(
			"vndb_v11_cutover_verification_checkpoint_cursor_storage_check",
			sql`${table.cursor} = array[]::text[] or (
				array_ndims(${table.cursor}) = 1
				and array_lower(${table.cursor}, 1) = 1
				and array_position(${table.cursor}, null::text) is null
			)`,
		),
		check(
			"vndb_v11_cutover_verification_checkpoint_cursor_check",
			sql`cardinality(${table.cursor}) = 0 or cardinality(${table.cursor}) = case
				when ${table.relation} = 'unit_structure_primary_path_backfill' then 1
				when ${table.relation} in (
					'unit_structure_primary_path_projection',
					'unit_tag_judgment_stat',
					'unit_structure_application_judgment_stat',
					'realm_tag_judgment_timestamps'
				) then 4
				when ${table.relation} in (
					'unit_tag_judgment_timestamps',
					'unit_structure_application_judgment_timestamps',
					'subject_association_judgment_stat'
				) then 3
				when ${table.relation} = 'realm_tag_judgment_stat' then 5
			end`,
		),
		check(
			"vndb_v11_cutover_verification_checkpoint_accumulator_storage_check",
			sql`(
				${table.accumulatorKey} = array[]::uuid[] or (
					array_ndims(${table.accumulatorKey}) = 1
					and array_lower(${table.accumulatorKey}, 1) = 1
					and array_position(${table.accumulatorKey}, null::uuid) is null
				)
			) and (
				${table.accumulator} = array[]::text[] or (
					array_ndims(${table.accumulator}) = 1
					and array_lower(${table.accumulator}, 1) = 1
					and array_position(${table.accumulator}, null::text) is null
				)
			)`,
		),
		check(
			"vndb_v11_cutover_verification_checkpoint_accumulator_check",
			sql`(
				cardinality(${table.accumulatorKey}) = 0
				and cardinality(${table.accumulator}) = 0
			) or (
				${table.relation} = 'unit_structure_primary_path_projection'
				and cardinality(${table.accumulatorKey}) = 1
				and cardinality(${table.accumulator}) in (0, 5)
			) or (
				${table.relation} in (
					'unit_tag_judgment_stat',
					'unit_structure_application_judgment_stat'
				)
				and cardinality(${table.accumulatorKey}) = 2
				and cardinality(${table.accumulator}) = case
					when ${table.relation} = 'unit_tag_judgment_stat' then 8
					else 7
				end
			) or (
				${table.relation} = 'realm_tag_judgment_stat'
				and cardinality(${table.accumulatorKey}) = 3
				and cardinality(${table.accumulator}) = 7
			) or (
				${table.relation} = 'subject_association_judgment_stat'
				and cardinality(${table.accumulatorKey}) = 1
				and cardinality(${table.accumulator}) = 5
			)`,
		),
		check(
			"vndb_v11_cutover_verification_checkpoint_scanned_count_check",
			sql`${table.scannedRowCount} >= 0`,
		),
		check(
			"vndb_v11_cutover_verification_checkpoint_count_check",
			sql`${table.scannedRowCount} >= 0
				and ${table.verifiedRowCount} >= 0
				and ${table.verifiedRowCount} <= ${table.scannedRowCount}`,
		),
		check(
			"vndb_v11_cutover_verification_checkpoint_checksum_check",
			sql`${table.checksum} ~ '^[0-9a-f]{64}$'`,
		),
		check(
			"vndb_v11_cutover_verification_checkpoint_completion_check",
			sql`(
				${table.relationProof} is null
				and ${table.completedAt} is null
			) or (
				${table.relationProof} ~ '^[0-9a-f]{64}$'
				and ${table.completedAt} is not null
				and cardinality(${table.accumulatorKey}) = 0
				and cardinality(${table.accumulator}) = 0
			)`,
		),
		check(
			"vndb_v11_cutover_verification_checkpoint_time_check",
			sql`${table.updatedAt} >= ${table.startedAt}
				and (${table.completedAt} is null or ${table.completedAt} >= ${table.startedAt})`,
		),
	],
);

/** Immutable, exact-epoch proof assembled from all nine completed scans. */
export const vndbV11CutoverVerificationProof = pgTable(
	"vndb_v11_cutover_verification_proof",
	{
		transitionEpoch: bigint({ mode: "bigint" }).primaryKey(),
		verificationContract: text().notNull(),
		relationCount: integer().notNull(),
		verifiedRowCount: bigint({ mode: "bigint" }).notNull(),
		proof: text().notNull(),
		verifiedBy: text().notNull(),
		completedAt: createTimestampMsColumn().notNull(),
	},
	(table) => [
		foreignKey({
			columns: [table.transitionEpoch],
			foreignColumns: [vndbV11CutoverTransition.transitionEpoch],
			name: "vndb_v11_cutover_verification_proof_epoch_fkey",
		}).onDelete("restrict"),
		check("vndb_v11_cutover_verification_proof_epoch_check", sql`${table.transitionEpoch} > 0`),
		check(
			"vndb_v11_cutover_verification_proof_relation_count_check",
			sql`${table.relationCount} = ${VndbV11CutoverVerificationRelationValues.length}`,
		),
		check(
			"vndb_v11_cutover_verification_proof_contract_check",
			sql`${table.verificationContract} = ${VndbV11CutoverVerificationContract}`,
		),
		check(
			"vndb_v11_cutover_verification_proof_row_count_check",
			sql`${table.verifiedRowCount} >= 0`,
		),
		check(
			"vndb_v11_cutover_verification_proof_checksum_check",
			sql`${table.proof} ~ '^[0-9a-f]{64}$'`,
		),
		check(
			"vndb_v11_cutover_verification_proof_operator_check",
			sql`btrim(${table.verifiedBy}) <> ''`,
		),
	],
);
