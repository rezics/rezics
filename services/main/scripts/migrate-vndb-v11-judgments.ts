import { readFile, readdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { config as loadEnv } from "dotenv";
import { Client } from "pg";
import { z } from "zod";

import {
	VndbV11BinaryContractStartupOption,
	VndbV11CutoverAdvisoryLockKey,
} from "../src/services/database/vndb-v11-contract";
import {
	assertCurrentVndbV11CutoverVerificationProof,
	assertVndbV11PrimaryPathOnlineBackfillComplete,
	runVndbV11PrimaryPathOnlineBackfill,
	runVndbV11PrimaryPathVerification,
	runVndbV11CutoverVerification,
} from "./vndb-v11-cutover-verification";

const ScriptDirectory = dirname(fileURLToPath(import.meta.url));
const MigrationDirectory = resolve(ScriptDirectory, "../src/services/database/migrations");

loadEnv({
	path: resolve(ScriptDirectory, "../../../.env"),
	quiet: true,
});

const CutoverLockName = "rezics:vndb-v11-judgment-cutover:2.0.0";
const CutoverControlTable = "vndb_v11_cutover_control";
const CutoverTransitionTable = "vndb_v11_cutover_transition";
const CutoverFenceFunctionSignature = "public.enforce_vndb_v11_cutover_write_fence()";
const CutoverControlTransitionFunctionSignature =
	"public.enforce_vndb_v11_cutover_control_transition()";
const CutoverControlProtectFunctionSignature = "public.protect_vndb_v11_cutover_control()";
const CutoverTransitionProtectFunctionSignature = "public.protect_vndb_v11_cutover_transition()";
const CutoverFenceTrigger = "vndb_v11_cutover_write_fence";
const DefaultBatchSize = 10_000;
const MaximumBatchSize = 50_000;
const TargetBatchMilliseconds = 500;
const MaximumBatchWalBytes = 64 * 1024 * 1024;
const MaximumReplicaLagSeconds = 5;
const MaximumReplicaWalLagBytes = 256 * 1024 * 1024;
const MaximumConnectionPressure = 0.7;
const BackpressurePollMilliseconds = 500;
const BackpressureLogMilliseconds = 10_000;
const MaximumBackpressureWaitMilliseconds = 5 * 60 * 1_000;

const Usage = `VNDB v11 judgment cutover

Run preflight before migration and after any interrupted attempt. Production
operators must keep each Atlas application to exactly one reviewed migration:

     task services-main:db:vndb-v11:preflight

Then follow this sequence:

  1. While legacy writers remain live, apply only the additive transactional prepare
     migration, then validate its staged projection-version checks online.
     task services-main:db:vndb-v11:prepare -- --yes
  2. Still with legacy writers live, build only the concurrent pre-index migration.
     task services-main:db:vndb-v11:preindex -- --yes
  3. Confirm preflight reports preindexed. Stop external admission, drain Unit-merge
     and Path-correction workers, then close the durable database writer fence. Its
     advisory-lock transition waits for in-flight request, batch, admin, and worker writes.
     task services-main:db:vndb-v11:pause -- --yes --operator <id> --reason <reason>
     Apply only the transactional contract migration.
     task services-main:db:vndb-v11:contract -- --yes
  4. Keep writers paused and backfill independent fit/spoiler timestamps.
     task services-main:db:vndb-v11:backfill -- --yes [--batch-size 10000]
  5. Deploy matching service and worker binaries and invalidate old Tag/Path and
     Structure cursors.
     Do not restart writers/workers yet. Constraint validation uses PostgreSQL's
     online validation lock.
     task services-main:db:vndb-v11:validate -- --yes
  6. Verify timestamp, constraint, and all four aggregate projections, then resume writers.
     task services-main:db:vndb-v11:verify -- --yes
     task services-main:db:vndb-v11:resume -- --yes --operator <id> --reason <reason>

Direct invocation:
  yarn exec tsx scripts/migrate-vndb-v11-judgments.ts \\
    --mode <preflight|migrate-guard|validate-prepare|primary-path-backfill|pause|primary-path-verify|backfill|validate|verify|resume> \\
    [--expect-state <legacy|prepared|preindexed|final>] [--require-drained] \
    [--yes] [--batch-size <1..50000>] [--operator <id>] [--reason <text>]

Backfill batches only derive independent fit/spoiler timestamps from each existing
judgment row. They disable origin triggers transaction-locally, never insert a
judgment, and are safe to resume because every update targets missing metadata.
The in-process cursor is only an optimization; the persisted missing-timestamp
predicate is the durable checkpoint. Validation groups each table's constraints
into one online SHARE UPDATE EXCLUSIVE scan. Every post-contract stage is idempotent,
but no command crosses the required deploy/cursor-invalidating boundary.
Preflight proves one of five structural states (legacy, prepared, preindexed, final, or partial),
cross-checks Atlas's per-statement ledger, and blocks unsafe partial recovery.`;

const ModeValues = [
	"preflight",
	"migrate-guard",
	"validate-prepare",
	"primary-path-backfill",
	"pause",
	"primary-path-verify",
	"backfill",
	"validate",
	"verify",
	"resume",
] as const;
const modeSchema = z.enum(ModeValues);
const PreflightStateValues = ["legacy", "prepared", "preindexed", "final"] as const;
const preflightStateSchema = z.enum(PreflightStateValues);
const postgresUuidString = z.string().regex(/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i);
const lsnRowSchema = z.object({ lsn: z.string().regex(/^[0-9a-f]+\/[0-9a-f]+$/i) }).strict();
const walDifferenceRowSchema = z.object({ bytes: z.number().finite().nonnegative() }).strict();
const booleanRowSchema = z.object({ value: z.boolean() }).strict();
const nameArrayRowSchema = z.object({ names: z.array(z.string().min(1)) }).strict();
const backpressureRowSchema = z
	.object({
		connectionPressure: z.number().finite().nonnegative(),
		lockWaits: z.number().int().nonnegative(),
		replicaLagSeconds: z.number().finite().nonnegative(),
		replicaWalLagBytes: z.number().finite().nonnegative(),
	})
	.strict();
const constraintStateRowSchema = z
	.object({ name: z.string().min(1), validated: z.boolean() })
	.strict();
const preparedConstraintStateRowSchema = z
	.object({
		definitionMatches: z.boolean(),
		exists: z.boolean(),
		name: z.string().min(1),
		validated: z.boolean(),
	})
	.strict();
const relationStateRowSchema = z.object({ exists: z.boolean(), name: z.string().min(1) }).strict();
const legacyTriggerStateRowSchema = z
	.object({
		enabled: z.boolean(),
		exists: z.boolean(),
		functionMatches: z.boolean(),
		table: z.string().min(1),
		trigger: z.string().min(1),
	})
	.strict();
const legacyFunctionStateRowSchema = z
	.object({ exists: z.boolean(), signature: z.string().min(1) })
	.strict();
const preparedColumnStateRowSchema = z
	.object({
		column: z.string().min(1),
		dataType: z.string().nullable(),
		defaultExpression: z.string().nullable(),
		exists: z.boolean(),
		matches: z.boolean(),
		notNull: z.boolean().nullable(),
		relationKind: z.string().nullable(),
		table: z.string().min(1),
	})
	.strict();
const indexStateRowSchema = z
	.object({
		columns: z.array(z.string().min(1)),
		expressionFree: z.boolean(),
		functionSignatures: z.array(z.string().min(1)),
		indexName: z.string().min(1),
		keyCount: z.number().int().positive(),
		live: z.boolean(),
		method: z.string().min(1),
		ownerMatches: z.boolean(),
		predicate: z.string().nullable(),
		ready: z.boolean(),
		tableName: z.string().min(1),
		totalColumnCount: z.number().int().positive(),
		unique: z.boolean(),
		valid: z.boolean(),
	})
	.strict();
const atlasRevisionRowSchema = z
	.object({
		applied: z.number().int().nonnegative(),
		error: z.string().nullable(),
		errorStmt: z.string().nullable(),
		partialHashes: z.array(z.string().regex(/^h1:[A-Za-z0-9+/=]+$/)),
		total: z.number().int().nonnegative(),
		version: z.string().regex(/^\d{14}$/),
	})
	.strict();
const CutoverControlStateValues = ["precontract_open", "paused", "postcontract_open"] as const;
const cutoverControlStateSchema = z.enum(CutoverControlStateValues);
const cutoverControlRowSchema = z
	.object({
		operator: z.string().nullable(),
		reason: z.string().nullable(),
		state: cutoverControlStateSchema,
		stateChangedAt: z.string().min(1),
		transitionEpoch: z.string().regex(/^\d+$/),
	})
	.strict();
const cutoverControlTableRowSchema = cutoverControlRowSchema
	.extend({ id: z.literal(1) })
	.transform(({ id: _id, ...row }) => row);
const cutoverTransitionSummaryRowSchema = z
	.object({
		continuous: z.boolean(),
		currentMatches: z.boolean(),
	})
	.strict();
const cutoverFunctionRowSchema = z
	.object({
		configuration: z.array(z.string()),
		definition: z.string().nullable(),
		exists: z.boolean(),
		securityDefiner: z.boolean(),
		volatility: z.string().nullable(),
	})
	.strict();

const cutoverFenceTriggerRowSchema = z
	.object({
		before: z.boolean(),
		delete: z.boolean(),
		enabled: z.boolean(),
		exists: z.boolean(),
		functionMatches: z.boolean(),
		insert: z.boolean(),
		rowLevel: z.boolean(),
		table: z.string().min(1),
		truncate: z.boolean(),
		update: z.boolean(),
	})
	.strict();

interface CutoverControlStateProof {
	readonly contractIntact: boolean;
	readonly row: z.infer<typeof cutoverControlRowSchema> | null;
	readonly triggerIssues: readonly string[];
}

type Mode = z.infer<typeof modeSchema>;
type PreflightState = z.infer<typeof preflightStateSchema>;

interface Options {
	readonly batchSize: number;
	readonly confirmed: boolean;
	readonly expectedState: PreflightState | undefined;
	readonly help: boolean;
	readonly mode: Mode;
	readonly operator: string | undefined;
	readonly reason: string | undefined;
	readonly requireDrained: boolean;
}

const JudgmentKeyColumnValues = [
	"realm_id",
	"unit_id",
	"tag_id",
	"structure_id",
	"profile_id",
] as const;
type JudgmentKeyColumn = (typeof JudgmentKeyColumnValues)[number];

interface SparseJudgmentRelation {
	readonly keyColumns: readonly JudgmentKeyColumn[];
	readonly name: "realm_tag_judgment" | "unit_structure_application_judgment" | "unit_tag_judgment";
}

const SparseJudgmentRelations = [
	{
		name: "unit_tag_judgment",
		keyColumns: ["unit_id", "tag_id", "profile_id"],
	},
	{
		name: "unit_structure_application_judgment",
		keyColumns: ["unit_id", "structure_id", "profile_id"],
	},
	{
		name: "realm_tag_judgment",
		keyColumns: ["realm_id", "unit_id", "tag_id", "profile_id"],
	},
] as const satisfies readonly SparseJudgmentRelation[];

const MigrationLogicalNames = [
	"vndb_v11_prepare",
	"vndb_v11_concurrent_indexes",
	"vndb_v11_contract",
] as const;
type MigrationLogicalName = (typeof MigrationLogicalNames)[number];

interface MigrationIdentity {
	readonly filename: string;
	readonly logicalName: MigrationLogicalName;
	readonly version: string;
}

interface ConcurrentIndexExpectation {
	readonly columns: readonly string[];
	readonly expressionFree?: boolean;
	readonly finalName?: string;
	readonly finalTable: string;
	readonly finalPredicate: string | null;
	readonly functionSignatures?: readonly string[];
	readonly legacyTable: string;
	readonly legacyPredicate: string | null;
	readonly name: string;
	readonly unique?: boolean;
}

const ConcurrentIndexExpectations: readonly ConcurrentIndexExpectation[] = [
	{
		name: "unit_tag_judgment_tag_unit_idx",
		legacyTable: "unit_tag_vote",
		finalTable: "unit_tag_judgment",
		columns: ["tag_id", "unit_id"],
		legacyPredicate: null,
		finalPredicate: null,
	},
	{
		name: "unit_tag_judgment_profile_unit_tag_idx",
		legacyTable: "unit_tag_vote",
		finalTable: "unit_tag_judgment",
		columns: ["profile_id", "unit_id", "tag_id"],
		legacyPredicate: null,
		finalPredicate: null,
	},
	{
		name: "unit_structure_application_judgment_profile_idx",
		legacyTable: "unit_structure_application_vote",
		finalTable: "unit_structure_application_judgment",
		columns: ["profile_id", "unit_id", "structure_id"],
		legacyPredicate: null,
		finalPredicate: null,
	},
	{
		name: "unit_structure_application_judgment_structure_idx",
		legacyTable: "unit_structure_application_vote",
		finalTable: "unit_structure_application_judgment",
		columns: ["structure_id", "unit_id", "profile_id"],
		legacyPredicate: null,
		finalPredicate: null,
	},
	{
		name: "unit_structure_application_judgment_positive_structure_idx",
		legacyTable: "unit_structure_application_vote",
		finalTable: "unit_structure_application_judgment",
		columns: ["structure_id", "unit_id", "profile_id"],
		legacyPredicate: "value = 1",
		finalPredicate: "fit_vote = 1",
	},
	{
		name: "realm_tag_judgment_profile_route_idx",
		legacyTable: "realm_tag_vote",
		finalTable: "realm_tag_judgment",
		columns: ["profile_id", "realm_id", "unit_id", "tag_id"],
		legacyPredicate: null,
		finalPredicate: null,
	},
	{
		name: "realm_tag_judgment_tag_route_idx",
		legacyTable: "realm_tag_vote",
		finalTable: "realm_tag_judgment",
		columns: ["tag_id", "realm_id", "unit_id", "profile_id"],
		legacyPredicate: null,
		finalPredicate: null,
	},
	{
		name: "realm_tag_judgment_stat_unit_realm_tag_idx",
		legacyTable: "realm_tag_vote_stat",
		finalTable: "realm_tag_judgment_stat",
		columns: ["unit_id", "realm_id", "tag_id"],
		legacyPredicate: null,
		finalPredicate: null,
	},
	{
		name: "realm_tag_judgment_stat_tag_realm_unit_idx",
		legacyTable: "realm_tag_vote_stat",
		finalTable: "realm_tag_judgment_stat",
		columns: ["tag_id", "realm_id", "unit_id"],
		legacyPredicate: null,
		finalPredicate: null,
	},
	{
		name: "realm_unit_tag_tag_route_idx",
		legacyTable: "realm_unit_tag",
		finalTable: "realm_unit_tag",
		columns: ["tag_id", "realm_id", "unit_id"],
		legacyPredicate: null,
		finalPredicate: null,
	},
	{
		name: "unit_structure_application_correction_shard_idx",
		legacyTable: "unit_structure_application",
		finalTable: "unit_structure_application",
		columns: [
			"structure_id",
			"(pg_catalog.get_byte(pg_catalog.uuid_send(unit_id), 15))",
			"unit_id",
		],
		expressionFree: false,
		functionSignatures: ["get_byte(bytea,integer)", "uuid_send(uuid)"],
		legacyPredicate: null,
		finalPredicate: null,
	},
	{
		name: "unit_structure_application_judgment_positive_correction_shard_idx",
		legacyTable: "unit_structure_application_vote",
		finalTable: "unit_structure_application_judgment",
		columns: [
			"structure_id",
			"(pg_catalog.get_byte(pg_catalog.uuid_send(unit_id), 15))",
			"unit_id",
			"profile_id",
		],
		expressionFree: false,
		functionSignatures: ["get_byte(bytea,integer)", "uuid_send(uuid)"],
		legacyPredicate: "value = 1",
		finalPredicate: "fit_vote = 1",
	},
	{
		name: "unit_tag_structure_support_member_idx",
		legacyTable: "unit_tag_structure_support",
		finalTable: "unit_tag_structure_support",
		columns: ["structure_id", "projection_version", "tag_id", "unit_id", "profile_id"],
		legacyPredicate: null,
		finalPredicate: null,
	},
	{
		name: "unit_tag_structure_support_application_judgment_idx",
		legacyTable: "unit_tag_structure_support",
		finalTable: "unit_tag_structure_support",
		columns: ["unit_id", "structure_id", "profile_id", "projection_version", "tag_id"],
		legacyPredicate: null,
		finalPredicate: null,
	},
	{
		name: "unit_structure_member_projection_pkey_ccnew",
		legacyTable: "unit_structure_member",
		finalTable: "unit_structure_member",
		finalName: "unit_structure_member_pkey",
		columns: ["structure_id", "projection_version", "ordinal"],
		legacyPredicate: null,
		finalPredicate: null,
		unique: true,
	},
	{
		name: "unit_structure_member_projection_member_key_ccnew",
		legacyTable: "unit_structure_member",
		finalTable: "unit_structure_member",
		finalName: "unit_structure_member_structure_projection_member_key",
		columns: ["structure_id", "projection_version", "member_unit_id"],
		legacyPredicate: null,
		finalPredicate: null,
		unique: true,
	},
	{
		name: "unit_structure_edge_projection_pkey_ccnew",
		legacyTable: "unit_structure_edge",
		finalTable: "unit_structure_edge",
		finalName: "unit_structure_edge_pkey",
		columns: ["structure_id", "projection_version", "ordinal"],
		legacyPredicate: null,
		finalPredicate: null,
		unique: true,
	},
	{
		name: "unit_tag_structure_support_projection_pkey_ccnew",
		legacyTable: "unit_tag_structure_support",
		finalTable: "unit_tag_structure_support",
		finalName: "unit_tag_structure_support_pkey",
		columns: ["unit_id", "tag_id", "profile_id", "structure_id", "projection_version"],
		legacyPredicate: null,
		finalPredicate: null,
		unique: true,
	},
];

const ConcurrentlyRemovedLegacyIndexes = [
	"unit_tag_vote_tag_idx",
	"unit_tag_vote_profile_idx",
	"unit_structure_application_vote_profile_idx",
	"realm_tag_vote_profile_idx",
	"unit_tag_structure_support_structure_idx",
] as const;

function normalizeMigrationStatement(statement: string): string {
	return statement
		.replace(/\s+/g, " ")
		.replace(/\(\s+/g, "(")
		.replace(/\s+\)/g, ")")
		.trim()
		.replace(/;$/, "")
		.toLowerCase();
}

/**
 * Proves the txmode-none file is a fixed sequence of dependency-free,
 * schema-anchored statements that can each resume on a fresh connection.
 */
export function assertConcurrentMigrationResumeSafe(source: string): readonly string[] {
	const withoutDirectivesAndComments = source
		.replace(/^\s*--\s*atlas:[^\r\n]*(?:\r?\n|$)/gim, "")
		.replace(/\/\*[\s\S]*?\*\//g, "")
		.replace(/--[^\r\n]*/g, "");
	const fragments = withoutDirectivesAndComments.split(";");
	if (fragments.pop()?.trim())
		throw new Error("The concurrent-index migration must terminate every statement");
	const actual = fragments.map((statement) => normalizeMigrationStatement(statement));
	const expected = [
		...ConcurrentIndexExpectations.map((expectation) =>
			normalizeMigrationStatement(
				`CREATE ${expectation.unique ? "UNIQUE " : ""}INDEX CONCURRENTLY ${expectation.name} ON public.${expectation.legacyTable} (${expectation.columns.join(", ")})${expectation.legacyPredicate ? ` WHERE ${expectation.legacyPredicate}` : ""}`,
			),
		),
		...ConcurrentlyRemovedLegacyIndexes.map((name) =>
			normalizeMigrationStatement(`DROP INDEX CONCURRENTLY IF EXISTS public.${name}`),
		),
	];
	if (actual.length !== expected.length)
		throw new Error(
			`Expected ${expected.length} concurrent-index statements, found ${actual.length}`,
		);
	for (const [index, statement] of actual.entries()) {
		if (statement !== expected[index])
			throw new Error(
				`Concurrent-index statement ${index + 1} is not the reviewed schema-anchored operation`,
			);
	}
	return actual;
}

interface LegacyTriggerExpectation {
	readonly functionSignature: string;
	readonly table: string;
	readonly trigger: string;
}

const LegacyTriggerExpectations = [
	{
		table: "realm_tag_vote",
		trigger: "realm_tag_vote_realm_tag_voting_enabled",
		functionSignature: "public.enforce_realm_tag_voting_enabled()",
	},
	{
		table: "realm_tag_vote",
		trigger: "realm_tag_vote_stat_maintain",
		functionSignature: "public.maintain_realm_tag_vote_stat()",
	},
	{
		table: "unit_structure_application_vote",
		trigger: "unit_structure_application_vote_stat_maintain",
		functionSignature: "public.maintain_unit_structure_application_vote_stat()",
	},
	{
		table: "unit_structure_application_vote",
		trigger: "unit_structure_application_vote_support_maintain",
		functionSignature: "public.maintain_structure_application_support()",
	},
	{
		table: "unit_structure_application_vote",
		trigger: "unit_structure_application_vote_tag_conflict",
		functionSignature: "public.reject_conflicting_structure_application_vote()",
	},
	{
		table: "unit_tag_vote",
		trigger: "unit_tag_vote_effective_maintain",
		functionSignature: "public.maintain_effective_tag_from_direct_vote()",
	},
	{
		table: "unit_tag_vote",
		trigger: "unit_tag_vote_structure_conflict",
		functionSignature: "public.reject_conflicting_direct_tag_vote()",
	},
	{
		table: "unit_effective_tag_vote",
		trigger: "unit_tag_vote_stat_maintain",
		functionSignature: "public.maintain_unit_tag_vote_stat()",
	},
	{
		table: "unit_structure",
		trigger: "unit_structure_definition_validate",
		functionSignature: "public.prepare_unit_structure_definition()",
	},
	{
		table: "unit_structure",
		trigger: "unit_structure_definition_project",
		functionSignature: "public.project_unit_structure_definition()",
	},
] as const satisfies readonly LegacyTriggerExpectation[];

interface CutoverFenceRelation {
	readonly finalTable: string;
	readonly legacyTable: string;
}

/** Every legacy request, batch, admin, correction, and merge admission write owner. */
export const CutoverFenceRelations = [
	{ legacyTable: "unit_tag", finalTable: "unit_tag" },
	{ legacyTable: "realm_unit_tag", finalTable: "realm_unit_tag" },
	{ legacyTable: "profile_unit_tag", finalTable: "profile_unit_tag" },
	{ legacyTable: "unit_tag_vote", finalTable: "unit_tag_judgment" },
	{ legacyTable: "unit_structure", finalTable: "unit_structure" },
	{ legacyTable: "unit_structure_vote", finalTable: "unit_structure_vote" },
	{
		legacyTable: "unit_structure_application",
		finalTable: "unit_structure_application",
	},
	{
		legacyTable: "unit_structure_application_vote",
		finalTable: "unit_structure_application_judgment",
	},
	{ legacyTable: "realm_tag_context", finalTable: "realm_tag_context" },
	{ legacyTable: "realm_tag_vote", finalTable: "realm_tag_judgment" },
	{ legacyTable: "unit_merge_operation", finalTable: "unit_merge_operation" },
] as const satisfies readonly CutoverFenceRelation[];

/** The additive prepare overlay fences exactly the old-binary mutation roots. */
export const PreparedCutoverFenceTables = CutoverFenceRelations.map(
	({ legacyTable }) => legacyTable,
);

/** Final adds authoritative sources whose writes only exist in matching v11 binaries. */
export const FinalCutoverFenceTables = [
	...CutoverFenceRelations.map(({ finalTable }) => finalTable),
	"entity_measurement",
	"subject_association_judgment",
	"unit_structure_correction",
] as const;

const ExpectedFenceTriggerType = {
	before: true,
	delete: true,
	insert: true,
	rowLevel: false,
	truncate: true,
	update: true,
} as const;

const LegacyFunctionSignatures = [
	...new Set([
		...LegacyTriggerExpectations.map(({ functionSignature }) => functionSignature),
		"public.refresh_unit_structure_application_vote_stat(uuid,uuid)",
		"public.refresh_unit_effective_tag_vote(uuid,uuid,uuid)",
	]),
] as const;

interface PreparedStateColumnExpectation {
	readonly column: string;
	readonly dataType: "boolean" | "integer" | "text" | "uuid";
	readonly defaultExpression: string | null;
	readonly notNull: boolean;
	readonly table: string;
}

/** Additive prepare markers required before any corpus-scale concurrent index build. */
export const PreparedStateColumns = [
	{
		table: "unit_structure",
		column: "active_projection_version",
		dataType: "integer",
		notNull: true,
		defaultExpression: "1",
	},
	{
		table: "unit_structure_member",
		column: "projection_version",
		dataType: "integer",
		notNull: true,
		defaultExpression: "1",
	},
	{
		table: "unit_structure_end",
		column: "projection_version",
		dataType: "integer",
		notNull: true,
		defaultExpression: "1",
	},
	{
		table: "unit_structure_edge",
		column: "projection_version",
		dataType: "integer",
		notNull: true,
		defaultExpression: "1",
	},
	{
		table: "unit_tag_structure_support",
		column: "projection_version",
		dataType: "integer",
		notNull: true,
		defaultExpression: "1",
	},
	{
		table: "unit_structure_primary_path_candidate",
		column: "projection_version",
		dataType: "integer",
		notNull: true,
		defaultExpression: null,
	},
	{
		table: "tag_primary_display_path",
		column: "structure_projection_version",
		dataType: "integer",
		notNull: true,
		defaultExpression: null,
	},
	{
		table: "unit_structure_correction_policy",
		column: "admission_open",
		dataType: "boolean",
		notNull: true,
		defaultExpression: "true",
	},
	{
		table: "unit_structure_correction",
		column: "status",
		dataType: "text",
		notNull: true,
		defaultExpression: "'pending'::text",
	},
	{
		table: "unit_structure_correction_shard",
		column: "shard",
		dataType: "integer",
		notNull: true,
		defaultExpression: null,
	},
	{
		table: "unit_structure_correction_tag_reservation",
		column: "job_id",
		dataType: "uuid",
		notNull: true,
		defaultExpression: null,
	},
	{
		table: "unit_structure_correction_unit_reservation",
		column: "job_id",
		dataType: "uuid",
		notNull: true,
		defaultExpression: null,
	},
	{
		table: "unit_structure_correction_effective_vote",
		column: "job_id",
		dataType: "uuid",
		notNull: true,
		defaultExpression: null,
	},
	{
		table: "unit_structure_correction_tag_projection",
		column: "job_id",
		dataType: "uuid",
		notNull: true,
		defaultExpression: null,
	},
	{
		table: "unit_structure_correction_primary_path",
		column: "job_id",
		dataType: "uuid",
		notNull: true,
		defaultExpression: null,
	},
	{
		table: "unit_structure_correction_activation",
		column: "job_id",
		dataType: "uuid",
		notNull: false,
		defaultExpression: null,
	},
] as const satisfies readonly PreparedStateColumnExpectation[];

export const PreparedStateRelations = [
	"unit_structure_end",
	"unit_structure_primary_path_candidate",
	"tag_primary_display_path",
	"unit_structure_correction_policy",
	"unit_structure_correction",
	"unit_structure_correction_shard",
	"unit_structure_correction_tag_reservation",
	"unit_structure_correction_unit_reservation",
	"unit_structure_correction_effective_vote",
	"unit_structure_correction_tag_projection",
	"unit_structure_correction_primary_path",
	"unit_structure_correction_activation",
	"vndb_v11_cutover_transition",
	"vndb_v11_cutover_verification_checkpoint",
	"vndb_v11_cutover_verification_proof",
	"vndb_v11_primary_path_backfill_progress",
	"vndb_v11_primary_path_dirty_key",
] as const;

const LegacyRelations = [
	"unit_tag_vote",
	"unit_tag_vote_stat",
	"unit_structure_application_vote",
	"unit_structure_application_vote_stat",
	"realm_tag_vote",
	"realm_tag_vote_stat",
] as const;

const FinalOnlyRelations = [
	"entity_measurement",
	"subject_association_judgment",
	"subject_association_judgment_stat",
] as const;

interface ValidationConstraintGroup {
	readonly constraints: readonly string[];
	readonly table: string;
}

const PreparedValidationConstraintGroups = [
	{
		table: "unit_structure",
		constraints: ["unit_structure_active_projection_version_check"],
	},
	{
		table: "unit_structure_member",
		constraints: ["unit_structure_member_projection_version_check"],
	},
	{
		table: "unit_structure_edge",
		constraints: ["unit_structure_edge_projection_version_check"],
	},
	{
		table: "unit_tag_structure_support",
		constraints: ["unit_tag_structure_support_projection_version_check"],
	},
] as const satisfies readonly ValidationConstraintGroup[];

interface PreparedValidationConstraintExpectation {
	readonly column: string;
	readonly name: string;
	readonly table: string;
}

const PreparedValidationConstraintExpectations = [
	{
		table: "unit_structure",
		column: "active_projection_version",
		name: "unit_structure_active_projection_version_check",
	},
	{
		table: "unit_structure_member",
		column: "projection_version",
		name: "unit_structure_member_projection_version_check",
	},
	{
		table: "unit_structure_edge",
		column: "projection_version",
		name: "unit_structure_edge_projection_version_check",
	},
	{
		table: "unit_tag_structure_support",
		column: "projection_version",
		name: "unit_tag_structure_support_projection_version_check",
	},
] as const satisfies readonly PreparedValidationConstraintExpectation[];

const ValidationConstraintGroups = [
	{
		table: "unit_tag_judgment",
		constraints: [
			"unit_tag_judgment_fit_vote_check",
			"unit_tag_judgment_spoiler_level_check",
			"unit_tag_judgment_sparse_check",
			"unit_tag_judgment_fit_timestamp_check",
			"unit_tag_judgment_spoiler_timestamp_check",
		],
	},
	{
		table: "unit_structure_application_judgment",
		constraints: [
			"unit_structure_application_judgment_fit_vote_check",
			"unit_structure_application_judgment_spoiler_level_check",
			"unit_structure_application_judgment_sparse_check",
			"unit_structure_application_judgment_fit_timestamp_check",
			"unit_structure_application_judgment_spoiler_timestamp_check",
		],
	},
	{
		table: "realm_tag_judgment",
		constraints: [
			"realm_tag_judgment_fit_vote_check",
			"realm_tag_judgment_spoiler_level_check",
			"realm_tag_judgment_sparse_check",
			"realm_tag_judgment_fit_timestamp_check",
			"realm_tag_judgment_spoiler_timestamp_check",
		],
	},
	{
		table: "unit_tag_judgment_stat",
		constraints: [
			"unit_tag_judgment_stat_spoiler_count_check",
			"unit_tag_judgment_stat_spoiler_nonnegative_check",
		],
	},
	{
		table: "unit_structure_application_judgment_stat",
		constraints: [
			"unit_structure_application_judgment_stat_spoiler_count_check",
			"unit_structure_application_judgment_stat_spoiler_nonnegative_check",
		],
	},
	{
		table: "realm_tag_judgment_stat",
		constraints: [
			"realm_tag_judgment_stat_spoiler_count_check",
			"realm_tag_judgment_stat_spoiler_nonnegative_check",
		],
	},
	{
		table: "unit_tag_structure_support",
		constraints: [
			"unit_tag_structure_support_application_judgment_fkey",
			"unit_tag_structure_support_member_fkey",
		],
	},
	{
		table: "subject_association_judgment",
		constraints: ["subject_association_judgment_spoiler_level_check"],
	},
	{
		table: "subject_association_judgment_stat",
		constraints: [
			"subject_association_judgment_stat_spoiler_count_check",
			"subject_association_judgment_stat_spoiler_nonnegative_check",
		],
	},
	{
		table: "tag",
		constraints: ["tag_default_spoiler_level_check"],
	},
] as const satisfies readonly ValidationConstraintGroup[];

const RequiredRelations = [
	...SparseJudgmentRelations.map(({ name }) => name),
	...ValidationConstraintGroups.map(({ table }) => table),
	"subject_association_judgment",
	"subject_association_judgment_stat",
] as const;

const FinalStateRelations = [
	...SparseJudgmentRelations.map(({ name }) => name),
	"unit_tag_judgment_stat",
	"unit_structure_application_judgment_stat",
	"realm_tag_judgment_stat",
	...FinalOnlyRelations,
] as const;

export function parseOptions(args: readonly string[]): Options {
	let batchSize = DefaultBatchSize;
	let batchSizeProvided = false;
	let confirmed = false;
	let expectedState: PreflightState | undefined;
	let help = false;
	let mode: Mode = "preflight";
	let operator: string | undefined;
	let reason: string | undefined;
	let requireDrained = false;
	for (let index = 0; index < args.length; index += 1) {
		const argument = args[index];
		if (argument === "--help" || argument === "-h") {
			help = true;
			continue;
		}
		if (argument === "--yes") {
			confirmed = true;
			continue;
		}
		if (argument === "--require-drained") {
			requireDrained = true;
			continue;
		}
		if (argument === "--mode") {
			const parsed = modeSchema.safeParse(args[index + 1]);
			if (!parsed.success) throw new TypeError(`--mode must be ${ModeValues.join(", ")}`);
			mode = parsed.data;
			index += 1;
			continue;
		}
		if (argument === "--operator" || argument === "--reason") {
			const maximumLength = argument === "--operator" ? 200 : 1_000;
			const parsed = z
				.string()
				.trim()
				.min(1)
				.max(maximumLength)
				.refine((value) => !value.startsWith("--"))
				.safeParse(args[index + 1]);
			if (!parsed.success)
				throw new TypeError(
					`${argument} requires a non-empty value of at most ${maximumLength} characters`,
				);
			if (argument === "--operator") operator = parsed.data;
			else reason = parsed.data;
			index += 1;
			continue;
		}
		if (argument === "--batch-size") {
			const value = Number(args[index + 1]);
			if (!Number.isSafeInteger(value) || value < 1 || value > MaximumBatchSize)
				throw new TypeError(`--batch-size must be between 1 and ${MaximumBatchSize}`);
			batchSize = value;
			batchSizeProvided = true;
			index += 1;
			continue;
		}
		if (argument === "--expect-state") {
			const parsed = preflightStateSchema.safeParse(args[index + 1]);
			if (!parsed.success)
				throw new TypeError(`--expect-state must be ${PreflightStateValues.join(", ")}`);
			expectedState = parsed.data;
			index += 1;
			continue;
		}
		throw new TypeError(`Unknown vndb-v11 cutover argument: ${String(argument)}`);
	}
	if (expectedState !== undefined && mode !== "preflight")
		throw new TypeError("--expect-state is only valid with --mode preflight");
	if (
		batchSizeProvided &&
		mode !== "backfill" &&
		mode !== "primary-path-backfill" &&
		mode !== "primary-path-verify" &&
		mode !== "verify" &&
		mode !== "resume"
	)
		throw new TypeError("--batch-size is only valid for a bounded backfill or verification mode");
	if (requireDrained && (mode !== "preflight" || expectedState !== "preindexed"))
		throw new TypeError("--require-drained requires --mode preflight --expect-state preindexed");
	const changesFence = mode === "pause" || mode === "resume";
	if (changesFence && (!operator || !reason))
		throw new TypeError(`--mode ${mode} requires both --operator and --reason`);
	if (!changesFence && (operator !== undefined || reason !== undefined))
		throw new TypeError("--operator and --reason are only valid with --mode pause or resume");
	return {
		batchSize,
		confirmed,
		expectedState,
		help,
		mode,
		operator,
		reason,
		requireDrained,
	};
}

function quoteIdentifier(identifier: string): string {
	if (!/^[a-z][a-z0-9_]*$/.test(identifier))
		throw new TypeError(`Unsafe PostgreSQL identifier: ${identifier}`);
	return `"${identifier}"`;
}

async function queryOne<T>(
	client: Client,
	schema: z.ZodType<T>,
	query: string,
	parameters: readonly unknown[] = [],
): Promise<T> {
	const result = await client.query(query, [...parameters]);
	if (result.rows.length !== 1) throw new Error(`Expected one row, received ${result.rows.length}`);
	return schema.parse(result.rows[0]);
}

async function discoverMigrationIdentities(): Promise<
	ReadonlyMap<MigrationLogicalName, MigrationIdentity>
> {
	const entries = await readdir(MigrationDirectory, { withFileTypes: true });
	const identities = new Map<MigrationLogicalName, MigrationIdentity>();
	for (const logicalName of MigrationLogicalNames) {
		const expression = new RegExp(`^(\\d{14})_${logicalName}\\.sql$`);
		const matches = entries.flatMap((entry) => {
			if (!entry.isFile()) return [];
			const match = expression.exec(entry.name);
			return match?.[1]
				? [{ filename: entry.name, logicalName, version: match[1] } satisfies MigrationIdentity]
				: [];
		});
		if (matches.length !== 1)
			throw new Error(
				`Expected exactly one *_${logicalName}.sql migration, found ${matches.length}. Regenerate the reviewed v11 split before preflight.`,
			);
		const identity = matches[0];
		if (!identity) throw new Error(`Could not resolve ${logicalName}`);
		identities.set(logicalName, identity);
	}
	const prepare = identities.get("vndb_v11_prepare");
	const concurrent = identities.get("vndb_v11_concurrent_indexes");
	const contract = identities.get("vndb_v11_contract");
	const orderedMigrationFiles = entries
		.filter((entry) => entry.isFile() && /^\d{14}_.+\.sql$/.test(entry.name))
		.map((entry) => entry.name)
		.sort();
	const concurrentPosition = concurrent ? orderedMigrationFiles.indexOf(concurrent.filename) : -1;
	const contractPosition = contract ? orderedMigrationFiles.indexOf(contract.filename) : -1;
	const preparePosition = prepare ? orderedMigrationFiles.indexOf(prepare.filename) : -1;
	if (
		!prepare ||
		!concurrent ||
		!contract ||
		concurrentPosition !== preparePosition + 1 ||
		contractPosition !== concurrentPosition + 1
	)
		throw new Error(
			"The vndb_v11_prepare, vndb_v11_concurrent_indexes, and vndb_v11_contract migrations must be unique and adjacent in that order.",
		);
	assertConcurrentMigrationResumeSafe(
		await readFile(resolve(MigrationDirectory, concurrent.filename), "utf8"),
	);
	return identities;
}

type AtlasRevisionState =
	| { readonly kind: "pending"; readonly version: string }
	| {
			readonly applied: number;
			readonly error: string | null;
			readonly errorStmt: string | null;
			readonly kind: "complete" | "partial";
			readonly total: number;
			readonly version: string;
	  };

interface AtlasLedger {
	readonly exists: boolean;
	readonly revisions: ReadonlyMap<MigrationLogicalName, AtlasRevisionState>;
}

async function readAtlasLedger(
	client: Client,
	migrations: ReadonlyMap<MigrationLogicalName, MigrationIdentity>,
): Promise<AtlasLedger> {
	const ledgerExists = await queryOne(
		client,
		booleanRowSchema,
		"select to_regclass('public.atlas_schema_revisions') is not null as value",
	);
	const revisions = new Map<MigrationLogicalName, AtlasRevisionState>();
	if (!ledgerExists.value) {
		for (const logicalName of MigrationLogicalNames) {
			const migration = migrations.get(logicalName);
			if (!migration) throw new Error(`Missing discovered migration ${logicalName}`);
			revisions.set(logicalName, { kind: "pending", version: migration.version });
		}
		return { exists: false, revisions };
	}

	const prepare = migrations.get("vndb_v11_prepare");
	const concurrent = migrations.get("vndb_v11_concurrent_indexes");
	const contract = migrations.get("vndb_v11_contract");
	if (!prepare || !concurrent || !contract)
		throw new Error("Could not resolve all three v11 migration versions");
	const versions = [prepare.version, concurrent.version, contract.version];
	const result = await client.query(
		`select
			version,
			applied::int as applied,
			total::int as total,
			nullif(error, '') as error,
			nullif(error_stmt, '') as "errorStmt",
			coalesce(partial_hashes, '[]'::jsonb) as "partialHashes"
		from public.atlas_schema_revisions
		where version = any($1::text[])
		order by version`,
		[versions],
	);
	const rows = z.array(atlasRevisionRowSchema).parse(result.rows);
	for (const logicalName of MigrationLogicalNames) {
		const migration = migrations.get(logicalName);
		if (!migration) throw new Error(`Missing discovered migration ${logicalName}`);
		const row = rows.find((candidate) => candidate.version === migration.version);
		if (!row) {
			revisions.set(logicalName, { kind: "pending", version: migration.version });
			continue;
		}
		const complete =
			row.total > 0 &&
			row.applied === row.total &&
			row.error === null &&
			row.errorStmt === null &&
			row.partialHashes.length === 0;
		revisions.set(logicalName, {
			...row,
			kind: complete ? "complete" : "partial",
		});
	}
	return { exists: true, revisions };
}

async function readRelationStates(
	client: Client,
	names: readonly string[],
): Promise<ReadonlyMap<string, boolean>> {
	const result = await client.query(
		`select name, to_regclass('public.' || quote_ident(name)) is not null as exists
		from unnest($1::text[]) as required(name)
		order by name`,
		[[...new Set(names)]],
	);
	const rows = z.array(relationStateRowSchema).parse(result.rows);
	return new Map(rows.map((row) => [row.name, row.exists]));
}

async function readPreparedColumnStates(
	client: Client,
): Promise<readonly z.infer<typeof preparedColumnStateRowSchema>[]> {
	const result = await client.query(
		`with expected as (
			select *
			from unnest($1::text[], $2::text[], $3::text[], $4::boolean[], $5::text[])
				as required(table_name, column_name, data_type, not_null, default_expression)
		)
		select
			expected.table_name as table,
			expected.column_name as column,
			class.relkind::text as "relationKind",
			format_type(attribute.atttypid, attribute.atttypmod) as "dataType",
			attribute.attnotnull as "notNull",
			pg_get_expr(definition.adbin, definition.adrelid, true) as "defaultExpression",
			attribute.attnum is not null as exists,
			coalesce(
				class.relkind = 'r'
				and class.relpersistence = 'p'
				and not class.relispartition
				and attribute.attidentity = ''
				and attribute.attgenerated = ''
				and format_type(attribute.atttypid, attribute.atttypmod) = expected.data_type
				and attribute.attnotnull = expected.not_null
				and (
					(expected.default_expression is null and definition.oid is null)
					or pg_get_expr(definition.adbin, definition.adrelid, true)
						= expected.default_expression
				),
				false
			) as matches
		from expected
		left join pg_namespace namespace on namespace.nspname = 'public'
		left join pg_class class
			on class.relnamespace = namespace.oid
			and class.relname = expected.table_name
		left join pg_attribute attribute
			on attribute.attrelid = class.oid
			and attribute.attname = expected.column_name
			and attribute.attnum > 0
			and not attribute.attisdropped
		left join pg_attrdef definition
			on definition.adrelid = class.oid
			and definition.adnum = attribute.attnum
		order by expected.table_name, expected.column_name`,
		[
			PreparedStateColumns.map(({ table }) => table),
			PreparedStateColumns.map(({ column }) => column),
			PreparedStateColumns.map(({ dataType }) => dataType),
			PreparedStateColumns.map(({ notNull }) => notNull),
			PreparedStateColumns.map(({ defaultExpression }) => defaultExpression),
		],
	);
	return z
		.array(preparedColumnStateRowSchema)
		.length(PreparedStateColumns.length)
		.parse(result.rows);
}

async function readConcurrentIndexStates(
	client: Client,
): Promise<ReadonlyMap<string, z.infer<typeof indexStateRowSchema>>> {
	const result = await client.query(
		`select
			index_class.relname as "indexName",
			table_class.relname as "tableName",
			access_method.amname as method,
			index_state.indisvalid as valid,
			index_state.indisready as ready,
			index_state.indislive as live,
			index_state.indisunique as unique,
			pg_get_expr(index_state.indpred, index_state.indrelid, true) as predicate,
			index_state.indexprs is null as "expressionFree",
			index_class.relowner = table_class.relowner as "ownerMatches",
			coalesce((
				select array_agg(distinct referenced.oid::regprocedure::text order by referenced.oid::regprocedure::text)
				from pg_depend dependency
				join pg_proc referenced on referenced.oid = dependency.refobjid
				where dependency.classid = 'pg_class'::regclass
					and dependency.objid = index_state.indexrelid
					and dependency.refclassid = 'pg_proc'::regclass
			), array[]::text[]) as "functionSignatures",
			index_state.indnkeyatts::int as "keyCount",
			index_state.indnatts::int as "totalColumnCount",
			coalesce((
				select array_agg(pg_get_indexdef(index_state.indexrelid, position, true) order by position)
				from generate_series(1, index_state.indnkeyatts) as position
			), array[]::text[]) as columns
		from pg_index index_state
		join pg_class index_class on index_class.oid = index_state.indexrelid
		join pg_namespace index_namespace on index_namespace.oid = index_class.relnamespace
		join pg_class table_class on table_class.oid = index_state.indrelid
		join pg_namespace table_namespace on table_namespace.oid = table_class.relnamespace
		join pg_am access_method on access_method.oid = index_class.relam
		where index_namespace.nspname = 'public'
			and table_namespace.nspname = 'public'
			and index_class.relname = any($1::text[])
		order by index_class.relname`,
		[ConcurrentIndexExpectations.flatMap(({ finalName, name }) => [name, finalName ?? name])],
	);
	const rows = z.array(indexStateRowSchema).parse(result.rows);
	return new Map(rows.map((row) => [row.indexName, row]));
}

function normalizeIndexColumnDefinition(definition: string): string {
	return definition
		.replaceAll('"', "")
		.replaceAll("pg_catalog.", "")
		.replace(/\s+/g, " ")
		.trim()
		.replace(/^\((.*)\)$/, "$1");
}

function indexDefinitionMatches(
	state: z.infer<typeof indexStateRowSchema>,
	expectation: ConcurrentIndexExpectation,
	table: string,
): boolean {
	const expectedPredicate =
		table === expectation.legacyTable ? expectation.legacyPredicate : expectation.finalPredicate;
	return (
		state.tableName === table &&
		state.method === "btree" &&
		state.unique === (expectation.unique ?? false) &&
		state.ownerMatches &&
		state.expressionFree === (expectation.expressionFree ?? true) &&
		state.functionSignatures.join("|") === (expectation.functionSignatures ?? []).join("|") &&
		normalizeSimpleIndexPredicate(state.predicate) === expectedPredicate &&
		state.keyCount === expectation.columns.length &&
		state.totalColumnCount === expectation.columns.length &&
		state.columns.length === expectation.columns.length &&
		state.columns.every(
			(column, index) =>
				normalizeIndexColumnDefinition(column) ===
				normalizeIndexColumnDefinition(expectation.columns[index] ?? ""),
		)
	);
}

function normalizeSimpleIndexPredicate(predicate: string | null): string | null {
	if (predicate === null) return null;
	const normalized = predicate.replaceAll('"', "").replace(/\s+/g, " ").trim();
	const simpleEquality = /^\(*\s*([a-z][a-z0-9_]*)\s*=\s*(-?\d+)\s*\)*$/i.exec(normalized);
	return simpleEquality?.[1] && simpleEquality[2]
		? `${simpleEquality[1]} = ${simpleEquality[2]}`
		: normalized;
}

interface LegacyContractState {
	readonly intact: boolean;
	readonly missingFunctions: readonly string[];
	readonly triggerIssues: readonly string[];
}

async function readLegacyContractState(client: Client): Promise<LegacyContractState> {
	const triggerResult = await client.query(
		`with expected as (
			select *
			from unnest($1::text[], $2::text[], $3::text[])
				as required(table_name, trigger_name, function_signature)
		)
		select
			expected.table_name as "table",
			expected.trigger_name as trigger,
			trigger_state.oid is not null as exists,
			coalesce(trigger_state.tgenabled in ('O', 'A'), false) as enabled,
			coalesce(
				trigger_state.tgfoid = to_regprocedure(expected.function_signature),
				false
			) as "functionMatches"
		from expected
		left join pg_class table_class
			on table_class.oid = to_regclass('public.' || quote_ident(expected.table_name))
		left join pg_trigger trigger_state
			on trigger_state.tgrelid = table_class.oid
			and trigger_state.tgname = expected.trigger_name
			and not trigger_state.tgisinternal
		order by expected.table_name, expected.trigger_name`,
		[
			LegacyTriggerExpectations.map(({ table }) => table),
			LegacyTriggerExpectations.map(({ trigger }) => trigger),
			LegacyTriggerExpectations.map(({ functionSignature }) => functionSignature),
		],
	);
	const triggerStates = z.array(legacyTriggerStateRowSchema).parse(triggerResult.rows);
	const triggerIssues = triggerStates.flatMap((state) => {
		if (!state.exists) return [`${state.table}.${state.trigger}:missing`];
		const issues = [
			...(state.enabled ? [] : ["disabled"]),
			...(state.functionMatches ? [] : ["wrong-function"]),
		];
		return issues.length ? [`${state.table}.${state.trigger}:${issues.join("+")}`] : [];
	});

	const functionResult = await client.query(
		`select signature, to_regprocedure(signature) is not null as exists
		from unnest($1::text[]) as required(signature)
		order by signature`,
		[[...LegacyFunctionSignatures]],
	);
	const functionStates = z.array(legacyFunctionStateRowSchema).parse(functionResult.rows);
	const missingFunctions = functionStates
		.filter((state) => !state.exists)
		.map(({ signature }) => signature);
	return {
		intact: triggerIssues.length === 0 && missingFunctions.length === 0,
		missingFunctions,
		triggerIssues,
	};
}

export function cutoverControlRowIsValid(row: z.infer<typeof cutoverControlRowSchema>): boolean {
	const epoch = BigInt(row.transitionEpoch);
	if (row.state === "precontract_open" && epoch === 0n)
		return row.operator === null && row.reason === null;
	if (row.state === "precontract_open")
		return epoch > 0n && Boolean(row.operator?.trim()) && Boolean(row.reason?.trim());
	return epoch > 0n && Boolean(row.operator?.trim()) && Boolean(row.reason?.trim());
}

function definitionContainsInOrder(definition: string, fragments: readonly string[]): boolean {
	let cursor = 0;
	for (const fragment of fragments) {
		const position = definition.indexOf(fragment, cursor);
		if (position === -1) return false;
		cursor = position + fragment.length;
	}
	return true;
}

async function readCutoverFunctionIssues(client: Client): Promise<readonly string[]> {
	const signatures = [
		CutoverFenceFunctionSignature,
		CutoverControlTransitionFunctionSignature,
		CutoverControlProtectFunctionSignature,
		CutoverTransitionProtectFunctionSignature,
	] as const;
	const proofs = new Map<string, z.infer<typeof cutoverFunctionRowSchema>>();
	for (const signature of signatures) {
		const proof = await queryOne(
			client,
			cutoverFunctionRowSchema,
			`with required as (select to_regprocedure($1) as oid)
			select function_state.oid is not null as exists,
				case when function_state.oid is null then null
					else pg_get_functiondef(function_state.oid) end as definition,
				function_state.provolatile::text as volatility,
				coalesce(function_state.prosecdef, false) as "securityDefiner",
				coalesce(function_state.proconfig, array[]::text[]) as configuration
			from required
			left join pg_proc function_state on function_state.oid = required.oid`,
			[signature],
		);
		proofs.set(signature, proof);
	}
	const issues: string[] = [];
	for (const [signature, proof] of proofs) {
		const searchPath = proof.configuration.map((entry) => entry.replace(/\s+/g, ""));
		if (
			!proof.exists ||
			proof.definition === null ||
			proof.volatility !== "v" ||
			proof.securityDefiner ||
			searchPath.length !== 1 ||
			searchPath[0] !== "search_path=pg_catalog,public"
		)
			issues.push(`${signature}:catalog-contract`);
	}
	const fenceDefinition = proofs.get(CutoverFenceFunctionSignature)?.definition ?? "";
	if (
		!definitionContainsInOrder(fenceDefinition, [
			"current_setting('transaction_isolation')",
			"pg_catalog.pg_advisory_xact_lock_shared(71011001::bigint)",
			"FROM public.vndb_v11_cutover_control",
		]) ||
		!fenceDefinition.includes("vndb_v11_cutover_read_committed_required") ||
		!fenceDefinition.includes("vndb_v11_writers_paused") ||
		!fenceDefinition.includes("rezics.vndb_v11_binary_contract") ||
		!fenceDefinition.includes("vndb-v11-contract-v1")
	)
		issues.push(`${CutoverFenceFunctionSignature}:definition-contract`);
	const transitionDefinition =
		proofs.get(CutoverControlTransitionFunctionSignature)?.definition ?? "";
	if (
		!definitionContainsInOrder(transitionDefinition, [
			"pg_catalog.pg_try_advisory_xact_lock(71011001::bigint)",
			"legacy_contract :=",
			"final_contract :=",
			"INSERT INTO public.vndb_v11_cutover_transition",
		]) ||
		!transitionDefinition.includes("vndb_v11_cutover_transition_busy") ||
		!transitionDefinition.includes("vndb_v11_cutover_epoch_invalid")
	)
		issues.push(`${CutoverControlTransitionFunctionSignature}:definition-contract`);
	if (
		!(proofs.get(CutoverControlProtectFunctionSignature)?.definition ?? "").includes(
			"vndb_v11_cutover_control_immutable",
		)
	)
		issues.push(`${CutoverControlProtectFunctionSignature}:definition-contract`);
	if (
		!(proofs.get(CutoverTransitionProtectFunctionSignature)?.definition ?? "").includes(
			"vndb_v11_cutover_transition_immutable",
		)
	)
		issues.push(`${CutoverTransitionProtectFunctionSignature}:definition-contract`);
	return issues;
}

async function readCutoverControlState(
	client: Client,
	useFinalTableNames: boolean,
): Promise<CutoverControlStateProof | null> {
	const relation = await queryOne(
		client,
		booleanRowSchema,
		`select to_regclass('public.${CutoverControlTable}') is not null as value`,
	);
	if (!relation.value) return null;

	const controlResult = await client.query(
		`select id::int, state, transition_epoch::text as "transitionEpoch",
			state_changed_at::text as "stateChangedAt", operator, reason
		from public.${CutoverControlTable}
		order by id`,
	);
	const controlRows = z.array(cutoverControlTableRowSchema).length(1).parse(controlResult.rows);
	const row = controlRows[0] ?? null;
	const auditSummary = row
		? await queryOne(
				client,
				cutoverTransitionSummaryRowSchema,
				`select
					(count(*) = $1::bigint + 1
						and min(transition_epoch) = 0
						and max(transition_epoch) = $1::bigint) as continuous,
					(count(*) filter (where transition_epoch = $1::bigint
						and state = $2
						and transitioned_at = $3::timestamptz
						and operator is not distinct from $4::text
						and reason is not distinct from $5::text) = 1) as "currentMatches"
				from public.${CutoverTransitionTable}`,
				[row.transitionEpoch, row.state, row.stateChangedAt, row.operator, row.reason],
			)
		: null;

	const controlPlaneTriggerExpectations = [
		{
			table: CutoverControlTable,
			trigger: "vndb_v11_cutover_control_transition",
			functionSignature: CutoverControlTransitionFunctionSignature,
			insert: false,
			update: true,
			delete: false,
			truncate: false,
			rowLevel: true,
		},
		{
			table: CutoverControlTable,
			trigger: "vndb_v11_cutover_control_row_protect",
			functionSignature: CutoverControlProtectFunctionSignature,
			insert: true,
			update: false,
			delete: true,
			truncate: false,
			rowLevel: true,
		},
		{
			table: CutoverControlTable,
			trigger: "vndb_v11_cutover_control_truncate_protect",
			functionSignature: CutoverControlProtectFunctionSignature,
			insert: false,
			update: false,
			delete: false,
			truncate: true,
			rowLevel: false,
		},
		{
			table: CutoverTransitionTable,
			trigger: "vndb_v11_cutover_transition_mutation_protect",
			functionSignature: CutoverTransitionProtectFunctionSignature,
			insert: true,
			update: true,
			delete: true,
			truncate: false,
			rowLevel: true,
		},
		{
			table: CutoverTransitionTable,
			trigger: "vndb_v11_cutover_transition_truncate_protect",
			functionSignature: CutoverTransitionProtectFunctionSignature,
			insert: false,
			update: false,
			delete: false,
			truncate: true,
			rowLevel: false,
		},
	] as const;
	const controlPlaneTriggerStates = await Promise.all(
		controlPlaneTriggerExpectations.map(async (expectation) => ({
			expectation,
			state: await queryOne(
				client,
				cutoverFenceTriggerRowSchema,
				`select
					$1::text as table,
					trigger_state.oid is not null as exists,
					coalesce(trigger_state.tgenabled = 'O', false) as enabled,
					coalesce(trigger_state.tgfoid = to_regprocedure($2::text), false) as "functionMatches",
					coalesce((trigger_state.tgtype::int & 1) <> 0, false) as "rowLevel",
					coalesce((trigger_state.tgtype::int & 2) <> 0, false) as before,
					coalesce((trigger_state.tgtype::int & 4) <> 0, false) as insert,
					coalesce((trigger_state.tgtype::int & 8) <> 0, false) as delete,
					coalesce((trigger_state.tgtype::int & 16) <> 0, false) as update,
					coalesce((trigger_state.tgtype::int & 32) <> 0, false) as truncate
				from (select to_regclass('public.' || quote_ident($1::text)) as oid) required
				left join pg_trigger trigger_state
					on trigger_state.tgrelid = required.oid
					and trigger_state.tgname = $3
					and not trigger_state.tgisinternal`,
				[expectation.table, expectation.functionSignature, expectation.trigger],
			),
		})),
	);
	const controlPlaneTriggerIssues = controlPlaneTriggerStates.flatMap(({ expectation, state }) => {
		if (!state.exists) return [`${expectation.table}.${expectation.trigger}:missing`];
		const issues = [
			...(state.enabled ? [] : ["disabled-or-replica-mode"]),
			...(state.functionMatches ? [] : ["wrong-function"]),
			...(state.before ? [] : ["not-before"]),
			...(state.rowLevel === expectation.rowLevel ? [] : ["wrong-level"]),
			...(state.insert === expectation.insert ? [] : ["wrong-insert-event"]),
			...(state.update === expectation.update ? [] : ["wrong-update-event"]),
			...(state.delete === expectation.delete ? [] : ["wrong-delete-event"]),
			...(state.truncate === expectation.truncate ? [] : ["wrong-truncate-event"]),
		];
		return issues.length ? [`${expectation.table}.${expectation.trigger}:${issues.join("+")}`] : [];
	});

	const tables = useFinalTableNames ? FinalCutoverFenceTables : PreparedCutoverFenceTables;
	const triggerResult = await client.query(
		`with expected as (
			select table_name from unnest($1::text[]) as required(table_name)
		)
		select
			expected.table_name as table,
			trigger_state.oid is not null as exists,
			coalesce(trigger_state.tgenabled = 'O', false) as enabled,
			coalesce(trigger_state.tgfoid = to_regprocedure($2::text), false) as "functionMatches",
			coalesce((trigger_state.tgtype::int & 1) <> 0, false) as "rowLevel",
			coalesce((trigger_state.tgtype::int & 2) <> 0, false) as before,
			coalesce((trigger_state.tgtype::int & 4) <> 0, false) as insert,
			coalesce((trigger_state.tgtype::int & 8) <> 0, false) as delete,
			coalesce((trigger_state.tgtype::int & 16) <> 0, false) as update,
			coalesce((trigger_state.tgtype::int & 32) <> 0, false) as truncate
		from expected
		left join pg_class table_class
			on table_class.oid = to_regclass('public.' || quote_ident(expected.table_name))
		left join pg_trigger trigger_state
			on trigger_state.tgrelid = table_class.oid
			and trigger_state.tgname = $3
			and not trigger_state.tgisinternal
		order by expected.table_name`,
		[tables, CutoverFenceFunctionSignature, CutoverFenceTrigger],
	);
	const triggerRows = z
		.array(cutoverFenceTriggerRowSchema)
		.length(tables.length)
		.parse(triggerResult.rows);
	const triggerIssues = triggerRows.flatMap((state) => {
		if (!state.exists) return [`${state.table}.${CutoverFenceTrigger}:missing`];
		const issues = [
			...(state.enabled ? [] : ["disabled-or-replica-mode"]),
			...(state.functionMatches ? [] : ["wrong-function"]),
			...(state.before === ExpectedFenceTriggerType.before ? [] : ["not-before"]),
			...(state.rowLevel === ExpectedFenceTriggerType.rowLevel ? [] : ["row-level"]),
			...(state.insert === ExpectedFenceTriggerType.insert ? [] : ["missing-insert"]),
			...(state.update === ExpectedFenceTriggerType.update ? [] : ["missing-update"]),
			...(state.delete === ExpectedFenceTriggerType.delete ? [] : ["missing-delete"]),
			...(state.truncate === ExpectedFenceTriggerType.truncate ? [] : ["missing-truncate"]),
		];
		return issues.length ? [`${state.table}.${CutoverFenceTrigger}:${issues.join("+")}`] : [];
	});
	const functionIssues = await readCutoverFunctionIssues(client);
	const controlIssues = [
		...functionIssues,
		...controlPlaneTriggerIssues,
		...triggerIssues,
		...(auditSummary?.continuous === true ? [] : [`${CutoverTransitionTable}:non-contiguous`]),
		...(auditSummary?.currentMatches === true
			? []
			: [`${CutoverTransitionTable}:current-mismatch`]),
	];
	return {
		contractIntact: row !== null && cutoverControlRowIsValid(row) && controlIssues.length === 0,
		row,
		triggerIssues: controlIssues,
	};
}

async function readUnitMergeOperationsDrained(client: Client): Promise<boolean> {
	const relation = await queryOne(
		client,
		booleanRowSchema,
		"select to_regclass('public.unit_merge_operation') is not null as value",
	);
	if (!relation.value) return true;
	const result = await queryOne(
		client,
		booleanRowSchema,
		`select not exists (
			select 1
			from public.unit_merge_operation
			where state not in ('completed', 'failed')
				or lease_token is not null
				or lease_expires_at is not null
			limit 1
		) as value`,
	);
	return result.value;
}

interface CorrectionDrainState {
	readonly admissionClosed: boolean;
	readonly drained: boolean;
}

async function readCorrectionDrainState(client: Client): Promise<CorrectionDrainState> {
	const relations = await readRelationStates(client, [
		"unit_structure_correction_policy",
		"unit_structure_correction",
		"unit_structure_correction_shard",
		"unit_structure_correction_tag_reservation",
		"unit_structure_correction_unit_reservation",
		"unit_structure_correction_activation",
	]);
	if ([...relations.values()].every((exists) => !exists))
		return { admissionClosed: false, drained: true };
	if ([...relations.values()].some((exists) => !exists))
		return { admissionClosed: false, drained: false };

	const result = await queryOne(
		client,
		z.object({ admissionClosed: z.boolean(), drained: z.boolean() }).strict(),
		`select
			coalesce((
				select not admission_open
				from public.unit_structure_correction_policy
				where id = true
			), false) as "admissionClosed",
			not (
				exists (
					select 1 from public.unit_structure_correction
					where status not in ('completed', 'failed', 'cancelled')
						or lease_owner is not null
						or lease_token is not null
						or lease_expires_at is not null
						or (
							status not in ('completed', 'failed', 'cancelled')
							and write_route <> 'target'
						)
					limit 1
				) or exists (
					select 1 from public.unit_structure_correction_shard
					where lease_owner is not null
						or lease_token is not null
						or lease_expires_at is not null
					limit 1
				) or exists (
					select 1 from public.unit_structure_correction_tag_reservation limit 1
				) or exists (
					select 1 from public.unit_structure_correction_unit_reservation limit 1
				) or exists (
					select 1 from public.unit_structure_correction_activation
					where job_id is not null
						or lease_owner is not null
						or lease_token is not null
						or lease_expires_at is not null
					limit 1
				)
			) as drained`,
	);
	return result;
}

async function readMissingValidationConstraints(client: Client): Promise<readonly string[]> {
	const missing: string[] = [];
	for (const group of ValidationConstraintGroups) {
		const result = await client.query(
			`select conname as name, convalidated as validated
			from pg_constraint
			where conrelid = to_regclass($1) and conname = any($2::text[])
			order by conname`,
			[`public.${group.table}`, [...group.constraints]],
		);
		const rows = z.array(constraintStateRowSchema).parse(result.rows);
		const present = new Set(rows.map(({ name }) => name));
		for (const constraint of group.constraints)
			if (!present.has(constraint)) missing.push(`public.${group.table}.${constraint}`);
	}
	return missing;
}

async function readPreparedValidationConstraintProof(
	client: Client,
	requireValidated = true,
): Promise<{
	readonly invalid: readonly string[];
	readonly present: readonly string[];
}> {
	const result = await client.query(
		`with expected as (
			select *
			from unnest($1::text[], $2::text[], $3::text[])
				as required(table_name, column_name, constraint_name)
		)
		select
			expected.constraint_name as name,
			constraint_state.oid is not null as exists,
			coalesce(
				constraint_state.contype = 'c'
				and constraint_state.conislocal
				and constraint_state.coninhcount = 0
				and not constraint_state.connoinherit
				and constraint_state.conparentid = 0
				and constraint_state.conenforced
				and constraint_state.conkey = array[attribute.attnum]::smallint[]
				and pg_get_expr(constraint_state.conbin, constraint_state.conrelid, true)
					= format('%I > 0', expected.column_name),
				false
			) as "definitionMatches",
			coalesce(constraint_state.convalidated, false) as validated
		from expected
		left join pg_namespace namespace on namespace.nspname = 'public'
		left join pg_class class
			on class.relnamespace = namespace.oid
			and class.relname = expected.table_name
		left join pg_attribute attribute
			on attribute.attrelid = class.oid
			and attribute.attname = expected.column_name
			and attribute.attnum > 0
			and not attribute.attisdropped
		left join pg_constraint constraint_state
			on constraint_state.conrelid = class.oid
			and constraint_state.conname = expected.constraint_name
		order by expected.table_name, expected.constraint_name`,
		[
			PreparedValidationConstraintExpectations.map(({ table }) => table),
			PreparedValidationConstraintExpectations.map(({ column }) => column),
			PreparedValidationConstraintExpectations.map(({ name }) => name),
		],
	);
	const states = z
		.array(preparedConstraintStateRowSchema)
		.length(PreparedValidationConstraintExpectations.length)
		.parse(result.rows);
	const byName = new Map(states.map((state) => [state.name, state]));
	const invalid = PreparedValidationConstraintExpectations.flatMap((expectation) => {
		const state = byName.get(expectation.name);
		const matches =
			state?.exists === true && state.definitionMatches && (!requireValidated || state.validated);
		return matches ? [] : [`public.${expectation.table}.${expectation.name}`];
	});
	return {
		invalid,
		present: PreparedValidationConstraintExpectations.flatMap((expectation) =>
			byName.get(expectation.name)?.exists === true
				? [`public.${expectation.table}.${expectation.name}`]
				: [],
		),
	};
}

function summarizeLedgerState(state: AtlasRevisionState | undefined): Record<string, unknown> {
	if (!state) return { kind: "missing" };
	if (state.kind === "pending") return state;
	return {
		applied: state.applied,
		error: state.error,
		errorStmt: state.errorStmt?.slice(0, 240) ?? null,
		kind: state.kind,
		total: state.total,
		version: state.version,
	};
}

type StructuralState = PreflightState | "partial";

type LedgerKind = AtlasRevisionState["kind"];

export function classifyLedgerMatchedState(
	structuralState: StructuralState,
	ledgerExists: boolean,
	ledgerKinds: Readonly<{
		contract: LedgerKind | undefined;
		prepare: LedgerKind | undefined;
		preindex: LedgerKind | undefined;
	}>,
): StructuralState {
	if (!ledgerExists) return "partial";
	const matches =
		(structuralState === "legacy" &&
			ledgerKinds.prepare === "pending" &&
			ledgerKinds.preindex === "pending" &&
			ledgerKinds.contract === "pending") ||
		(structuralState === "prepared" &&
			ledgerKinds.prepare === "complete" &&
			ledgerKinds.preindex === "pending" &&
			ledgerKinds.contract === "pending") ||
		(structuralState === "preindexed" &&
			ledgerKinds.prepare === "complete" &&
			ledgerKinds.preindex === "complete" &&
			ledgerKinds.contract === "pending") ||
		(structuralState === "final" &&
			ledgerKinds.prepare === "complete" &&
			ledgerKinds.preindex === "complete" &&
			ledgerKinds.contract === "complete");
	return matches ? structuralState : "partial";
}

async function preflightCutover(
	client: Client,
	expectedState?: PreflightState,
	requireDrained = false,
	allowPendingPreparedChecksForValidation = false,
): Promise<PreflightState> {
	const migrations = await discoverMigrationIdentities();
	await client.query("begin isolation level repeatable read read only");
	try {
		const relationStates = await readRelationStates(client, [
			...LegacyRelations,
			...PreparedStateRelations,
			...FinalStateRelations,
			...ConcurrentlyRemovedLegacyIndexes,
			CutoverControlTable,
		]);
		const preparedColumnStates = await readPreparedColumnStates(client);
		const preparedConstraintProof = await readPreparedValidationConstraintProof(
			client,
			!allowPendingPreparedChecksForValidation,
		);
		const preparedRelationsPresent = PreparedStateRelations.filter(
			(name) => relationStates.get(name) === true,
		);
		const preparedColumnsPresent = preparedColumnStates.filter(({ exists }) => exists);
		const allPrepared =
			preparedRelationsPresent.length === PreparedStateRelations.length &&
			preparedColumnStates.every(({ matches }) => matches) &&
			preparedConstraintProof.invalid.length === 0;
		const noPrepared =
			preparedRelationsPresent.length === 0 &&
			preparedColumnsPresent.length === 0 &&
			preparedConstraintProof.present.length === 0;
		const indexStates = await readConcurrentIndexStates(client);
		const ledger = await readAtlasLedger(client, migrations);

		const allLegacy = LegacyRelations.every((name) => relationStates.get(name) === true);
		const noLegacy = LegacyRelations.every((name) => relationStates.get(name) === false);
		const allFinal = FinalStateRelations.every((name) => relationStates.get(name) === true);
		const noFinal = FinalStateRelations.every((name) => relationStates.get(name) === false);
		const legacyContract = allLegacy && noFinal ? await readLegacyContractState(client) : null;
		const cutoverControl =
			relationStates.get(CutoverControlTable) === true
				? await readCutoverControlState(client, noLegacy && allFinal)
				: null;
		const mergeOperationsDrained = await readUnitMergeOperationsDrained(client);
		const correctionDrain = await readCorrectionDrainState(client);
		const legacyIndexesPresent = ConcurrentlyRemovedLegacyIndexes.filter(
			(name) => relationStates.get(name) === true,
		);
		const legacyIndexesMissing = ConcurrentlyRemovedLegacyIndexes.filter(
			(name) => relationStates.get(name) !== true,
		);
		const missingIndexes = ConcurrentIndexExpectations.filter(
			(expectation) =>
				!indexStates.has(expectation.name) &&
				!indexStates.has(expectation.finalName ?? expectation.name),
		).map(({ name }) => name);
		const invalidIndexes = ConcurrentIndexExpectations.filter((expectation) => {
			const states = [
				indexStates.get(expectation.name),
				indexStates.get(expectation.finalName ?? expectation.name),
			].filter((state) => state !== undefined);
			return states.some((state) => !state.valid || !state.ready || !state.live);
		}).map(({ name }) => name);
		const mismatchedIndexes = ConcurrentIndexExpectations.filter((expectation) => {
			const legacyState = indexStates.get(expectation.name);
			const finalState = indexStates.get(expectation.finalName ?? expectation.name);
			if (expectation.finalName)
				return (
					(legacyState !== undefined &&
						!indexDefinitionMatches(legacyState, expectation, expectation.legacyTable)) ||
					(finalState !== undefined &&
						!indexDefinitionMatches(finalState, expectation, expectation.finalTable))
				);
			return legacyState
				? !indexDefinitionMatches(legacyState, expectation, expectation.legacyTable) &&
						!indexDefinitionMatches(legacyState, expectation, expectation.finalTable)
				: false;
		}).map(({ name }) => name);
		const allIndexesOnLegacy = ConcurrentIndexExpectations.every((expectation) => {
			const state = indexStates.get(expectation.name);
			return (
				state?.valid === true &&
				state.ready &&
				state.live &&
				indexDefinitionMatches(state, expectation, expectation.legacyTable)
			);
		});
		const allIndexesOnFinal = ConcurrentIndexExpectations.every((expectation) => {
			const state = indexStates.get(expectation.finalName ?? expectation.name);
			return (
				state?.valid === true &&
				state.ready &&
				state.live &&
				indexDefinitionMatches(state, expectation, expectation.finalTable)
			);
		});
		const stalePrecontractIndexes = ConcurrentIndexExpectations.filter(
			(expectation) => expectation.finalName && indexStates.has(expectation.name),
		).map(({ name }) => name);
		const missingConstraints =
			noLegacy && allFinal ? await readMissingValidationConstraints(client) : [];

		let structuralState: StructuralState = "partial";
		if (
			allLegacy &&
			noFinal &&
			noPrepared &&
			cutoverControl === null &&
			legacyContract?.intact === true &&
			legacyIndexesPresent.length === ConcurrentlyRemovedLegacyIndexes.length &&
			missingIndexes.length === ConcurrentIndexExpectations.length
		)
			structuralState = "legacy";
		else if (
			allLegacy &&
			noFinal &&
			allPrepared &&
			cutoverControl?.contractIntact === true &&
			cutoverControl.row?.state === "precontract_open" &&
			legacyContract?.intact === true &&
			legacyIndexesPresent.length === ConcurrentlyRemovedLegacyIndexes.length &&
			missingIndexes.length === ConcurrentIndexExpectations.length
		)
			structuralState = "prepared";
		else if (
			allLegacy &&
			noFinal &&
			allPrepared &&
			cutoverControl?.contractIntact === true &&
			(cutoverControl.row?.state === "precontract_open" ||
				cutoverControl.row?.state === "paused") &&
			legacyContract?.intact === true &&
			legacyIndexesPresent.length === 0 &&
			allIndexesOnLegacy
		)
			structuralState = "preindexed";
		else if (
			noLegacy &&
			allFinal &&
			allPrepared &&
			cutoverControl?.contractIntact === true &&
			(cutoverControl.row?.state === "paused" ||
				cutoverControl.row?.state === "postcontract_open") &&
			legacyIndexesPresent.length === 0 &&
			stalePrecontractIndexes.length === 0 &&
			allIndexesOnFinal &&
			missingConstraints.length === 0
		)
			structuralState = "final";

		const prepareLedger = ledger.revisions.get("vndb_v11_prepare");
		const concurrentLedger = ledger.revisions.get("vndb_v11_concurrent_indexes");
		const contractLedger = ledger.revisions.get("vndb_v11_contract");
		const state = classifyLedgerMatchedState(structuralState, ledger.exists, {
			contract: contractLedger?.kind,
			prepare: prepareLedger?.kind,
			preindex: concurrentLedger?.kind,
		});
		console.info(
			`vndb-v11 preflight: ${JSON.stringify({
				cutoverControl,
				pathCorrection: correctionDrain,
				preparedMarkers: {
					invalidColumns: preparedColumnStates.filter(({ exists, matches }) => exists && !matches),
					missingColumns: preparedColumnStates
						.filter(({ exists }) => !exists)
						.map(({ column, table }) => `${table}.${column}`),
					missingRelations: PreparedStateRelations.filter(
						(name) => relationStates.get(name) !== true,
					),
					validationInvalid: preparedConstraintProof.invalid,
				},
				indexes: {
					invalid: invalidIndexes,
					mismatched: mismatchedIndexes,
					missing: missingIndexes,
					stalePrecontract: stalePrecontractIndexes,
				},
				legacyContracts: legacyContract,
				legacyIndexes: {
					missing: legacyIndexesMissing,
					present: legacyIndexesPresent,
				},
				ledger: {
					contract: summarizeLedgerState(contractLedger),
					exists: ledger.exists,
					prepare: summarizeLedgerState(prepareLedger),
					preindex: summarizeLedgerState(concurrentLedger),
				},
				state,
				structuralState,
				validationConstraintsMissing: missingConstraints,
				unitMergeOperationsDrained: mergeOperationsDrained,
			})}`,
		);

		if (state === "legacy") {
			console.info(
				"vndb-v11 preflight PASS (legacy): keep legacy writers live and run task services-main:db:vndb-v11:prepare -- --yes.",
			);
		} else if (state === "prepared") {
			console.info(
				"vndb-v11 preflight PASS (prepared): keep legacy writers live, validate prepared checks, and run task services-main:db:vndb-v11:preindex -- --yes.",
			);
		} else if (state === "preindexed") {
			console.info(
				"vndb-v11 preflight PASS (preindexed): pause and drain judgment writers and active unit merges, then run task services-main:db:vndb-v11:contract -- --yes.",
			);
		} else if (state === "final") {
			console.info(
				"vndb-v11 preflight PASS (final): proceed with task services-main:db:vndb-v11:backfill -- --yes.",
			);
		} else {
			const recovery: string[] = [];
			if (invalidIndexes.length)
				recovery.push(
					`The failed concurrent build left same-named INVALID indexes. After confirming Atlas's failed statement, remove only these indexes and retry Atlas at that statement:\n${invalidIndexes
						.map((name) => `DROP INDEX CONCURRENTLY public.${quoteIdentifier(name)};`)
						.join("\n")}`,
				);
			if (mismatchedIndexes.length)
				recovery.push(
					`Same-named indexes have unexpected owners or definitions (${mismatchedIndexes.join(", ")}); do not drop or reuse them automatically. Restore the pre-cutover snapshot or obtain a reviewed manual reconciliation.`,
				);
			if (legacyContract && !legacyContract.intact)
				recovery.push(
					"Legacy write contracts are missing, disabled, or attached to unexpected functions. Restore the exact legacy triggers/functions before building indexes; do not continue with writers live.",
				);
			if (
				structuralState === "partial" &&
				concurrentLedger?.kind === "pending" &&
				legacyIndexesMissing.length > 0
			)
				recovery.push(
					`Atlas has not recorded the preindex migration, but legacy indexes are already absent (${legacyIndexesMissing.join(", ")}). Treat this as drift: restore them or obtain a reviewed reconciliation before retrying.`,
				);
			if (!ledger.exists)
				recovery.push(
					"The Atlas revision table is absent. Use the standard database installation/baseline workflow; do not mark these migrations applied manually.",
				);
			if (concurrentLedger?.kind === "partial")
				recovery.push(
					"Atlas recorded a partial concurrent-index migration. Run task services-main:db:status and compare errorStmt with the exact index inventory above. When the failed CREATE left a same-named INVALID index, drop only that reviewed index concurrently and invoke `atlas migrate apply 1` directly so Atlas resumes at its recorded statement. After connection loss or any statement/ledger ambiguity, do not retry: restore the pre-cutover snapshot or obtain an exact operator reconciliation.",
				);
			if (prepareLedger?.kind === "partial" && structuralState === "legacy")
				recovery.push(
					"The transactional prepare migration did not commit and the exact legacy contracts remain intact. Correct the Atlas-reported cause, then invoke `atlas migrate apply 1` directly with the reviewed PGOPTIONS; PostgreSQL retries the prepare file transactionally.",
				);
			else if (prepareLedger?.kind === "partial")
				recovery.push(
					"Atlas reports a partial prepare migration but the schema is not exactly legacy. Do not retry automatically; restore the pre-cutover snapshot or obtain a reviewed statement-ledger reconciliation.",
				);
			if (contractLedger?.kind === "partial" && structuralState === "preindexed")
				recovery.push(
					"The transactional contract did not commit: all legacy relations and reviewed pre-indexes remain intact. Correct the Atlas-reported cause, pause/drain writers and unit merges, then rerun task services-main:db:vndb-v11:contract -- --yes; PostgreSQL retries the contract as one file transaction.",
				);
			else if (contractLedger?.kind === "partial")
				recovery.push(
					"Atlas reports a partial contract but the schema is not exactly preindexed. Do not retry automatically; restore the pre-cutover snapshot or obtain a reviewed statement-ledger reconciliation.",
				);
			if (!recovery.length)
				recovery.push(
					"Schema and Atlas ledger phases disagree. Do not rerun or mark a migration applied. Restore the pre-cutover snapshot or obtain a reviewed statement-ledger reconciliation.",
				);
			throw new Error(`vndb-v11 preflight BLOCKED (partial):\n${recovery.join("\n")}`);
		}
		if (expectedState !== undefined && state !== expectedState)
			throw new Error(
				`Expected vndb-v11 state ${expectedState}, observed ${state}; follow the state-specific action above instead of crossing migration phases.`,
			);
		if (
			requireDrained &&
			(cutoverControl?.row?.state !== "paused" ||
				!cutoverControl.contractIntact ||
				!mergeOperationsDrained ||
				!correctionDrain.admissionClosed ||
				!correctionDrain.drained)
		)
			throw new Error(
				"vndb-v11 contract BLOCKED: the durable fence must be paused, Path-correction admission closed, and every Unit-merge/correction job, reservation, activation, and lease terminal or absent. Stop admission/workers, drain accepted work, run db:vndb-v11:pause, then retry.",
			);
		await client.query("commit");
		return state;
	} catch (cause) {
		await client.query("rollback");
		throw cause;
	}
}

function transitionAudit(options: Options): { operator: string; reason: string } {
	if (!options.operator || !options.reason)
		throw new Error(
			`The ${options.mode} transition requires non-empty operator and reason audit fields`,
		);
	return { operator: options.operator, reason: options.reason };
}

async function acquireExclusiveCutoverFence(client: Client): Promise<void> {
	await client.query("select pg_catalog.pg_advisory_xact_lock($1::bigint)", [
		VndbV11CutoverAdvisoryLockKey.toString(),
	]);
}

async function setCorrectionAdmission(client: Client, open: boolean): Promise<void> {
	const result = await client.query(
		`update public.unit_structure_correction_policy
		set admission_open = $1, updated_at = clock_timestamp()
		where id = true
		returning true as value`,
		[open],
	);
	z.array(booleanRowSchema).length(1).parse(result.rows);
}

async function updateCutoverControl(
	client: Client,
	targetState: "paused" | "postcontract_open",
	operator: string,
	reason: string,
): Promise<z.infer<typeof cutoverControlRowSchema>> {
	const result = await client.query(
		`update public.${CutoverControlTable}
		set state = $1,
			transition_epoch = transition_epoch + 1,
			state_changed_at = clock_timestamp(),
			operator = $2,
			reason = $3
		where id = 1
		returning state, transition_epoch::text as "transitionEpoch",
			state_changed_at::text as "stateChangedAt", operator, reason`,
		[targetState, operator, reason],
	);
	return z.array(cutoverControlRowSchema).length(1).parse(result.rows)[0] as z.infer<
		typeof cutoverControlRowSchema
	>;
}

async function assertAllCutoverWorkDrained(client: Client): Promise<void> {
	const [mergeDrained, correction] = await Promise.all([
		readUnitMergeOperationsDrained(client),
		readCorrectionDrainState(client),
	]);
	if (!mergeDrained || !correction.admissionClosed || !correction.drained)
		throw new Error(
			"Cutover pause requires correction admission closed and all Unit-merge/correction jobs, reservations, activations, and leases terminal or absent",
		);
}

async function pauseCutoverWriters(
	client: Client,
	operator: string,
	reason: string,
): Promise<void> {
	await client.query("begin isolation level read committed");
	try {
		await acquireExclusiveCutoverFence(client);
		const control = await readCutoverControlState(client, false);
		if (!control?.contractIntact || !control.row)
			throw new Error("Cannot pause: the exact precontract cutover-control contract is not intact");
		if (control.row.state === "postcontract_open")
			throw new Error("Cannot pause a postcontract schema through the precontract pause command");

		await assertVndbV11PrimaryPathOnlineBackfillComplete(client);
		await setCorrectionAdmission(client, false);
		await assertAllCutoverWorkDrained(client);
		if (control.row.state === "precontract_open") {
			const updated = await updateCutoverControl(client, "paused", operator, reason);
			if (updated.state !== "paused") throw new Error("Cutover control did not enter paused state");
		}
		await client.query("commit");
	} catch (cause) {
		await client.query("rollback");
		throw cause;
	}
}

async function resumeCutoverWriters(
	client: Client,
	operator: string,
	reason: string,
): Promise<void> {
	await client.query("begin isolation level read committed");
	try {
		await acquireExclusiveCutoverFence(client);
		const control = await readCutoverControlState(client, true);
		if (!control?.contractIntact || !control.row)
			throw new Error("Cannot resume: the exact final cutover-control contract is not intact");
		if (control.row.state === "precontract_open")
			throw new Error("Cannot resume: final schema is still in precontract-open state");
		if (control.row.state === "paused") {
			await assertCurrentVndbV11CutoverVerificationProof(
				client,
				BigInt(control.row.transitionEpoch),
			);
			await assertAllCutoverWorkDrained(client);
			const updated = await updateCutoverControl(client, "postcontract_open", operator, reason);
			if (updated.state !== "postcontract_open")
				throw new Error("Cutover control did not enter postcontract-open state");
			await setCorrectionAdmission(client, true);
		} else {
			const correction = await readCorrectionDrainState(client);
			if (correction.admissionClosed)
				throw new Error("Postcontract control is open while correction admission remains closed");
		}
		await client.query("commit");
	} catch (cause) {
		await client.query("rollback");
		throw cause;
	}
}

async function pauseForBackpressure(client: Client): Promise<void> {
	const startedAt = performance.now();
	let nextLogAt = startedAt;
	while (true) {
		const state = await queryOne(
			client,
			backpressureRowSchema,
			`select
				(
					select count(*)::float8
						/ nullif(current_setting('max_connections')::float8, 0)
					from pg_stat_activity
					where backend_type = 'client backend'
				) as "connectionPressure",
				(select count(*)::int from pg_locks where not granted) as "lockWaits",
				coalesce((
					select max(extract(epoch from replay_lag))
					from pg_stat_replication
				), 0)::float8 as "replicaLagSeconds",
				coalesce((
					select max(pg_wal_lsn_diff(pg_current_wal_lsn(), replay_lsn))
					from pg_stat_replication
				), 0)::float8 as "replicaWalLagBytes"`,
		);
		if (
			state.connectionPressure <= MaximumConnectionPressure &&
			state.lockWaits === 0 &&
			state.replicaLagSeconds <= MaximumReplicaLagSeconds &&
			state.replicaWalLagBytes <= MaximumReplicaWalLagBytes
		)
			return;

		const now = performance.now();
		if (now >= nextLogAt) {
			console.info(`vndb-v11 cutover backpressure: ${JSON.stringify(state)}`);
			nextLogAt = now + BackpressureLogMilliseconds;
		}
		if (now - startedAt >= MaximumBackpressureWaitMilliseconds)
			throw new Error(
				"vndb-v11 cutover backpressure remained above its safety limits for five minutes; rerun the idempotent stage after the database recovers",
			);
		await new Promise((resolveWait) => setTimeout(resolveWait, BackpressurePollMilliseconds));
	}
}

async function assertExpectedSchema(client: Client): Promise<void> {
	const proof = await queryOne(
		client,
		nameArrayRowSchema,
		`select coalesce(
			array_agg(required.name order by required.name)
				filter (where to_regclass('public.' || quote_ident(required.name)) is null),
			array[]::text[]
		) as names
		from unnest($1::text[]) as required(name)`,
		[[...new Set(RequiredRelations)]],
	);
	if (proof.names.length)
		throw new Error(
			`Apply the vndb_v11_contract migration before this runner; missing relations: ${proof.names.join(", ")}`,
		);
}

async function databaseHasUnits(client: Client): Promise<boolean> {
	const relation = await queryOne(
		client,
		booleanRowSchema,
		"select to_regclass('public.unit') is not null as value",
	);
	if (!relation.value) return false;
	return (
		await queryOne(
			client,
			booleanRowSchema,
			"select exists (select 1 from public.unit limit 1) as value",
		)
	).value;
}

async function guardGenericMigrate(client: Client): Promise<void> {
	if (!(await databaseHasUnits(client))) {
		console.info(
			"vndb-v11 generic migrate guard PASS: public.unit is absent or empty, so the contract's empty-install guard is authoritative.",
		);
		return;
	}
	const state = await preflightCutover(client);
	if (state === "final") {
		console.info("vndb-v11 generic migrate guard PASS: the staged cutover is complete.");
		return;
	}
	if (state === "legacy")
		throw new Error(
			"Generic db:migrate is blocked from crossing the vndb-v11 cutover on a nonempty database. Run task services-main:db:vndb-v11:prepare -- --yes while legacy writers remain live.",
		);
	if (state === "prepared")
		throw new Error(
			"Generic db:migrate is blocked after vndb-v11 prepare. Run task services-main:db:vndb-v11:preindex -- --yes while legacy writers remain live.",
		);
	throw new Error(
		"Generic db:migrate is blocked at vndb-v11 preindexed state. Run the online primary-path proof, pause/drain the durable writer fence, then run task services-main:db:vndb-v11:contract -- --yes.",
	);
}

async function assertTimestampBackfillPrivilege(client: Client): Promise<void> {
	await client.query("begin");
	try {
		await client.query("set local session_replication_role = replica");
	} finally {
		await client.query("rollback");
	}
}

interface BatchProgress {
	readonly cursor: readonly string[];
	readonly updatedCount: number;
}

async function updateTimestampBatch(
	client: Client,
	relation: SparseJudgmentRelation,
	batchSize: number,
	cursor: readonly string[] | null,
): Promise<BatchProgress | null> {
	const quotedTable = quoteIdentifier(relation.name);
	const quotedKeys = relation.keyColumns.map(quoteIdentifier);
	const cursorPredicate = cursor
		? `and (${quotedKeys.join(", ")}) > (${quotedKeys
				.map((_, index) => `$${index + 2}::uuid`)
				.join(", ")})`
		: "";
	const batchProgressRowSchema = z
		.object({
			cursor: z.array(postgresUuidString).length(relation.keyColumns.length),
			updatedCount: z.number().int().positive().max(batchSize),
		})
		.strict();

	await client.query("begin");
	try {
		// Only metadata columns change. Suppressing origin triggers avoids replaying
		// aggregate/community-evidence effects for every historical judgment.
		await client.query("set local session_replication_role = replica");
		const result = await client.query(
			`with batch as materialized (
				select ${quotedKeys.join(", ")}
				from public.${quotedTable}
				where (
					(fit_vote is not null and fit_updated_at is null)
					or (spoiler_level is not null and spoiler_updated_at is null)
				)
				${cursorPredicate}
				order by ${quotedKeys.join(", ")}
				limit $1
				for update
			), updated as (
				update public.${quotedTable} as target
				set
					fit_updated_at = case
						when target.fit_vote is not null and target.fit_updated_at is null
							then target.updated_at
						else target.fit_updated_at
					end,
					spoiler_updated_at = case
						when target.spoiler_level is not null and target.spoiler_updated_at is null
							then target.updated_at
						else target.spoiler_updated_at
					end
				from batch
				where ${relation.keyColumns
					.map((column) => `target.${quoteIdentifier(column)} = batch.${quoteIdentifier(column)}`)
					.join(" and ")}
				returning ${relation.keyColumns
					.map((column) => `target.${quoteIdentifier(column)}`)
					.join(", ")}
			)
			select
				array[${quotedKeys.map((key) => `${key}::text`).join(", ")}] as cursor,
				count(*) over ()::int as "updatedCount"
			from updated
			order by ${quotedKeys.map((key) => `${key} desc`).join(", ")}
			limit 1`,
			[batchSize, ...(cursor ?? [])],
		);
		const rows = z.array(batchProgressRowSchema).max(1).parse(result.rows);
		await client.query("commit");
		return rows[0] ?? null;
	} catch (cause) {
		await client.query("rollback");
		throw cause;
	}
}

async function currentLsn(client: Client): Promise<string> {
	return (await queryOne(client, lsnRowSchema, "select pg_current_wal_lsn()::text as lsn")).lsn;
}

async function backfillRelation(
	client: Client,
	relation: SparseJudgmentRelation,
	initialBatchSize: number,
): Promise<number> {
	let cursor: readonly string[] | null = null;
	let batchSize = initialBatchSize;
	let updated = 0;
	while (true) {
		await pauseForBackpressure(client);
		const startedAt = performance.now();
		const walBefore = await currentLsn(client);
		const progress = await updateTimestampBatch(client, relation, batchSize, cursor);
		if (!progress) break;
		cursor = progress.cursor;
		updated += progress.updatedCount;
		const walAfter = await queryOne(
			client,
			walDifferenceRowSchema,
			"select pg_wal_lsn_diff(pg_current_wal_lsn(), $1)::float8 as bytes",
			[walBefore],
		);
		const elapsedMilliseconds = performance.now() - startedAt;
		console.info(
			`vndb-v11 backfill ${relation.name}: ${JSON.stringify({
				batch: progress.updatedCount,
				batchSize,
				cursor,
				elapsedMilliseconds: Math.round(elapsedMilliseconds),
				total: updated,
				walBytes: walAfter.bytes,
			})}`,
		);
		if (elapsedMilliseconds > TargetBatchMilliseconds || walAfter.bytes > MaximumBatchWalBytes)
			batchSize = Math.max(1, Math.floor(batchSize / 2));
		else if (elapsedMilliseconds < TargetBatchMilliseconds / 2)
			batchSize = Math.min(initialBatchSize, batchSize * 2);
	}
	console.info(
		`vndb-v11 backfill ${relation.name} complete: ${updated} rows updated; reruns select zero completed rows`,
	);
	return updated;
}

async function readConstraintStates(
	client: Client,
	group: ValidationConstraintGroup,
): Promise<ReadonlyMap<string, boolean>> {
	const result = await client.query(
		`select conname as name, convalidated as validated
		from pg_constraint
		where conrelid = $1::regclass and conname = any($2::text[])
		order by conname`,
		[`public.${group.table}`, [...group.constraints]],
	);
	const rows = z.array(constraintStateRowSchema).parse(result.rows);
	const states = new Map(rows.map((row) => [row.name, row.validated]));
	const missing = group.constraints.filter((constraint) => !states.has(constraint));
	if (missing.length)
		throw new Error(`Missing constraints on public.${group.table}: ${missing.join(", ")}`);
	return states;
}

async function validateConstraintGroups(
	client: Client,
	groups: readonly ValidationConstraintGroup[],
	scope: "prepare" | "final",
): Promise<void> {
	for (const group of groups) {
		const states = await readConstraintStates(client, group);
		const pending = group.constraints.filter((constraint) => states.get(constraint) === false);
		if (!pending.length) {
			console.info(`Already validated all vndb-v11 ${scope} constraints on public.${group.table}`);
			continue;
		}
		await pauseForBackpressure(client);
		// Grouping the subcommands lets PostgreSQL combine proof work into one
		// SHARE UPDATE EXCLUSIVE table scan while ordinary reads/writes continue.
		await client.query(
			`alter table public.${quoteIdentifier(group.table)} ${pending
				.map((constraint) => `validate constraint ${quoteIdentifier(constraint)}`)
				.join(", ")}`,
		);
		console.info(`Validated public.${group.table}: ${pending.join(", ")}`);
	}
}

async function validatePreparedConstraints(client: Client): Promise<void> {
	// This is the only caller allowed to classify an otherwise exact prepared
	// state while one or more reviewed CHECKs remain NOT VALID.
	await preflightCutover(client, "prepared", false, true);
	await validateConstraintGroups(client, PreparedValidationConstraintGroups, "prepare");
	const proof = await readPreparedValidationConstraintProof(client);
	if (proof.invalid.length)
		throw new Error(
			`Prepared constraint validation did not produce the exact enforced contract: ${proof.invalid.join(", ")}`,
		);
	await preflightCutover(client, "prepared");
}

async function validateConstraints(client: Client): Promise<void> {
	await validateConstraintGroups(client, ValidationConstraintGroups, "final");
}

async function verifyValidatedConstraints(client: Client): Promise<void> {
	const invalid: string[] = [];
	for (const group of ValidationConstraintGroups) {
		const states = await readConstraintStates(client, group);
		for (const constraint of group.constraints)
			if (states.get(constraint) !== true) invalid.push(`public.${group.table}.${constraint}`);
	}
	if (invalid.length) throw new Error(`Unvalidated vndb-v11 constraints: ${invalid.join(", ")}`);
}

async function verifyCutover(client: Client, batchSize: number): Promise<void> {
	const legacy = await queryOne(
		client,
		booleanRowSchema,
		`select to_regclass('public.unit_tag_vote') is not null
			or to_regclass('public.unit_structure_application_vote') is not null
			or to_regclass('public.realm_tag_vote') is not null as value`,
	);
	if (legacy.value) throw new Error("Legacy spoiler-bearing vote tables remain");

	await verifyValidatedConstraints(client);
	const verification = await runVndbV11CutoverVerification(client, batchSize, pauseForBackpressure);
	console.info(
		`Verified bounded exact-epoch vndb-v11 cutover proof: ${JSON.stringify({
			proof: verification.proof,
			transitionEpoch: verification.transitionEpoch.toString(),
		})}`,
	);
}

async function run(options: Options): Promise<void> {
	const databaseUrl = process.env.DATABASE_ADMIN_URL;
	if (!databaseUrl) throw new Error("DATABASE_ADMIN_URL is required");
	const client = new Client({
		connectionString: databaseUrl,
		options: VndbV11BinaryContractStartupOption,
		application_name: "rezics-vndb-v11-cutover",
	});
	await client.connect();
	try {
		await client.query("set lock_timeout = '5s'");
		await client.query("set statement_timeout = '30min'");
		await client.query("set idle_in_transaction_session_timeout = '60s'");
		await client.query("select pg_advisory_lock(hashtextextended($1, 0))", [CutoverLockName]);
		try {
			if (options.mode === "preflight") {
				await preflightCutover(client, options.expectedState, options.requireDrained);
				return;
			}
			if (options.mode === "migrate-guard") {
				await guardGenericMigrate(client);
				return;
			}
			if (options.mode === "validate-prepare") {
				await validatePreparedConstraints(client);
				console.info("vndb-v11 additive prepare checks validated online");
				return;
			}
			if (options.mode === "primary-path-backfill") {
				await preflightCutover(client, "prepared");
				await runVndbV11PrimaryPathOnlineBackfill(client, options.batchSize, pauseForBackpressure);
				console.info("vndb-v11 primary-path projection backfill caught up online");
				return;
			}
			if (options.mode === "pause") {
				await preflightCutover(client, "preindexed");
				const audit = transitionAudit(options);
				await pauseCutoverWriters(client, audit.operator, audit.reason);
				await preflightCutover(client, "preindexed", true);
				console.info(
					"vndb-v11 cutover pause completed; the durable fence is closed and work drained",
				);
				return;
			}
			if (options.mode === "primary-path-verify") {
				await preflightCutover(client, "preindexed", true);
				const transitionEpoch = await runVndbV11PrimaryPathVerification(
					client,
					options.batchSize,
					pauseForBackpressure,
				);
				console.info(
					`vndb-v11 primary-path projection proof sealed for paused epoch ${transitionEpoch}`,
				);
				return;
			}

			if (options.mode === "resume") {
				await preflightCutover(client, "final");
				await assertExpectedSchema(client);
				const beforeResume = await readCutoverControlState(client, true);
				if (!beforeResume?.contractIntact || beforeResume.row?.state !== "paused")
					throw new Error("Resume requires an intact final fence in paused state");
				await verifyCutover(client, options.batchSize);
				const audit = transitionAudit(options);
				await resumeCutoverWriters(client, audit.operator, audit.reason);
				await preflightCutover(client, "final");
				console.info("vndb-v11 cutover resume completed; only matching binaries may write");
				return;
			}

			await preflightCutover(client, "final");
			await assertExpectedSchema(client);
			const finalControl = await readCutoverControlState(client, true);
			if (!finalControl?.contractIntact || finalControl.row?.state !== "paused")
				throw new Error(`${options.mode} requires the exact final cutover fence to remain paused`);
			if (options.mode === "backfill") {
				await assertTimestampBackfillPrivilege(client);
				for (const relation of SparseJudgmentRelations)
					await backfillRelation(client, relation, options.batchSize);
			}
			if (options.mode === "validate") await validateConstraints(client);
			if (options.mode === "verify") await verifyCutover(client, options.batchSize);
			console.info(`vndb-v11 cutover ${options.mode} completed`);
		} finally {
			await client.query("select pg_advisory_unlock(hashtextextended($1, 0))", [CutoverLockName]);
		}
	} finally {
		await client.end();
	}
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	const options = parseOptions(process.argv.slice(2));
	if (options.help) console.info(Usage);
	else {
		if (!options.confirmed && options.mode !== "preflight" && options.mode !== "migrate-guard")
			throw new Error(
				`${options.mode === "backfill" ? "Backfill requires all judgment, Path-correction, and Unit-merge writers/workers to remain paused and drained. " : ""}Pass --yes after reviewing --help.`,
			);
		await run(options);
	}
}
