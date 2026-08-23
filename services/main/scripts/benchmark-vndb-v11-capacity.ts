import { writeFile } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";

import { Client, Pool, type PoolClient } from "pg";
import { z } from "zod";

const FixtureSchema = "vndb_v11_capacity";
const FixtureIdentity = "vndb-v11-capacity-v1";
const DisposableDatabaseName = "rezics_atlas";
const MinimumRepresentativeRows = 1_000_000;
const MaximumRepresentativeRows = MinimumRepresentativeRows;
const RealHotKeyConcurrency = 64;
const RealHotKeyPoolCapacity = 82;
const RealHotKeyMinimumLogicalRequests = 1_024;
const RealHotKeyMaximumRetries = 2;
const RealHotKeyRetryCapsMilliseconds = [25, 50] as const;
const RealHotKeyBusyConstraint = "vndb_vote_hot_key_busy";
const RealHotKeyLockTimeoutMilliseconds = 25;
const RealHotKeyMutationTimeoutMilliseconds = 1_500;

export const FinalWriterFenceTableNames = [
	"entity_measurement",
	"profile_unit_tag",
	"realm_tag_context",
	"realm_tag_judgment",
	"realm_unit_tag",
	"subject_association_judgment",
	"unit_merge_operation",
	"unit_structure",
	"unit_structure_application",
	"unit_structure_application_judgment",
	"unit_structure_correction",
	"unit_structure_vote",
	"unit_tag",
	"unit_tag_judgment",
] as const;

const LoopbackDatabaseHosts = new Set(["localhost", "127.0.0.1", "::1"]);

function normalizeDatabaseHostname(hostname: string): string {
	return hostname.startsWith("[") && hostname.endsWith("]") ? hostname.slice(1, -1) : hostname;
}

function isLoopbackDatabaseHost(hostname: string): boolean {
	return LoopbackDatabaseHosts.has(normalizeDatabaseHostname(hostname).toLowerCase());
}

/**
 * Constructs a client only after the connection string proves it targets the disposable fixture.
 *
 * The second host check covers node-postgres connection query parameters such as `?host=...`,
 * which can override the URI authority that the WHATWG URL parser exposes.
 */
export function createDisposableCapacityClient(connectionString: string): Client {
	let databaseUrl: URL;
	try {
		databaseUrl = new URL(connectionString);
	} catch {
		throw new Error("DATABASE_ADMIN_URL must be a valid PostgreSQL URL");
	}
	if (databaseUrl.protocol !== "postgres:" && databaseUrl.protocol !== "postgresql:")
		throw new Error("DATABASE_ADMIN_URL must use the postgres or postgresql protocol");
	if (!isLoopbackDatabaseHost(databaseUrl.hostname))
		throw new Error("DATABASE_ADMIN_URL must name localhost, 127.0.0.1, or ::1");
	if (databaseUrl.pathname !== `/${DisposableDatabaseName}`)
		throw new Error(
			`DATABASE_ADMIN_URL must name the exact disposable database ${DisposableDatabaseName}`,
		);

	const client = new Client({ connectionString });
	if (!isLoopbackDatabaseHost(client.host))
		throw new Error("DATABASE_ADMIN_URL connection options must retain a loopback host");
	if (client.database !== DisposableDatabaseName)
		throw new Error(
			`DATABASE_ADMIN_URL connection options must retain database ${DisposableDatabaseName}`,
		);
	return client;
}

const postgresUuidString = z.string().regex(/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i);
const integerString = z.string().regex(/^\d+$/).transform(Number);
const signedIntegerString = z
	.string()
	.regex(/^-?\d+$/)
	.transform(Number);
const signedNumberString = z
	.string()
	.regex(/^-?\d+(?:\.\d+)?(?:e[+-]?\d+)?$/i)
	.transform(Number);
const relationSizeRow = z.object({
	heapBytes: integerString,
	indexBytes: integerString,
	rowEstimate: signedNumberString,
	tableName: z.string().min(1),
	toastBytes: integerString,
	totalBytes: integerString,
});
const lsnRow = z.object({ lsn: z.string().regex(/^[0-9A-F]+\/[0-9A-F]+$/i) });
const walDifferenceRow = z.object({ bytes: signedNumberString });
const runtimeRow = z.object({
	databaseBytes: integerString,
	serverVersion: z.string().min(1),
	sharedBuffers: z.string().min(1),
	workMem: z.string().min(1),
});
const overlapRow = z.object({
	bothCount: integerString,
	fitCount: integerString,
	fitOnlyCount: integerString,
	rowCount: integerString,
	spoilerCount: integerString,
	spoilerOnlyCount: integerString,
});
const hotKeyRow = z.object({
	profileId: postgresUuidString,
	targetId: postgresUuidString,
	unitId: postgresUuidString,
});
const planEnvelope = z.object({
	"Execution Time": z.number().nonnegative(),
	Plan: z.record(z.string(), z.unknown()),
	"Planning Time": z.number().nonnegative(),
});
const explainRow = z.object({ "QUERY PLAN": z.array(planEnvelope).length(1) });
const quickAddCountsRow = z.object({
	application: integerString,
	applicationJudgment: integerString,
	applicationStat: integerString,
	effectiveTag: integerString,
	effectiveVote: integerString,
	structureSupport: integerString,
	tagStat: integerString,
});
const aggregateWriteCountRow = z.object({ count: integerString });
const realHotKeyReadinessRow = z.object({
	controlState: z.enum(["paused", "postcontract_open", "precontract_open"]).nullable(),
	evidenceRetentionForeignKeysExact: z.boolean(),
	evidenceRetentionIndexesReady: z.boolean(),
	fenceInventoryExact: z.boolean(),
	fenceTriggerCount: integerString,
	functionInstalled: z.boolean(),
	globalAdmissionIsBounded: z.boolean(),
	globalAdmissionIsFailFast: z.boolean(),
	globalAdmissionTriggerInstalled: z.boolean(),
	globalFenceTriggerInstalled: z.boolean(),
	globalTableInstalled: z.boolean(),
	hotKeyTriggerCount: integerString,
	realmAdmissionIsBounded: z.boolean(),
	realmAdmissionIsFailFast: z.boolean(),
	realmAdmissionTriggerInstalled: z.boolean(),
	realmFenceTriggerInstalled: z.boolean(),
	realmTableInstalled: z.boolean(),
	unitTagAdmissionTriggerInstalled: z.boolean(),
	unitTagJudgmentAdmissionTriggerInstalled: z.boolean(),
	writerFenceInstalled: z.boolean(),
	writerFenceBodyOrderValid: z.boolean(),
	writerFenceTransitionUsesExclusiveKey: z.boolean(),
	writerFenceUsesFixedAdvisoryKey: z.boolean(),
});
const realHotKeyCatalogReadinessRow = realHotKeyReadinessRow.omit({ controlState: true });
const cutoverControlStateRow = z.object({
	controlState: z.enum(["paused", "postcontract_open", "precontract_open"]),
});
const cutoverControlEpochRow = cutoverControlStateRow.extend({
	transitionEpoch: integerString,
});
const databaseCounterRow = z.object({
	activeClientConnections: integerString,
	deadlocks: integerString,
	maxConnections: integerString,
	reservedConnections: integerString,
	superuserReservedConnections: integerString,
});
const backendPidRow = z.object({ pid: z.number().int().positive() });
const advisoryLockCountRow = z.object({ count: integerString });
const writerFenceLockProofRow = z.object({
	grantedShareLocks: integerString,
	totalLocks: integerString,
});
const activityWaitRow = z.object({
	pid: z.number().int().positive(),
	waitEvent: z.string().nullable(),
	waitEventType: z.string().nullable(),
});
const aggregateParityRow = z.object({
	majorCount: integerString,
	minorCount: integerString,
	noneCount: integerString,
	score: signedIntegerString,
	spoilerCount: integerString,
	voteCount: integerString,
});
const globalProjectionParityRow = z.object({
	effectiveTags: integerString,
	effectiveTagViolations: integerString,
	effectiveVotes: integerString,
	effectiveVoteViolations: integerString,
	statRows: integerString,
	statViolations: integerString,
	structureSupports: integerString,
	structureSupportViolations: integerString,
});
const realmFactProfileRow = z.object({
	fitVote: z.number().int(),
	profileId: postgresUuidString,
	rowCount: integerString,
	tagId: postgresUuidString,
});
const globalFactProfileRow = z.object({
	fitVote: z.number().int(),
	profileId: postgresUuidString,
});

type JsonValue =
	| null
	| boolean
	| number
	| string
	| readonly JsonValue[]
	| { readonly [key: string]: JsonValue };

type PlanSummary = Readonly<{
	executionMilliseconds: number;
	indexNames: readonly string[];
	nodeTypes: readonly string[];
	planningMilliseconds: number;
	rowsRemovedByFilter: number;
	sharedHitBlocks: number;
	sharedReadBlocks: number;
	sharedWrittenBlocks: number;
}>;

type LatencySummary = Readonly<{
	completed: number;
	maxMilliseconds: number;
	p50Milliseconds: number;
	p95Milliseconds: number;
	p99Milliseconds: number;
	timedOut: number;
}>;

type QuickAddMutationCounts = Readonly<z.infer<typeof quickAddCountsRow>>;

type QuickAddSummary = Readonly<{
	pathLength: number;
	meanMillisecondsPerAdd: number;
	rowMutations: QuickAddMutationCounts;
	rowMutationsPerAdd: number;
	samples: number;
	totalMilliseconds: number;
	walBytes: number;
	walBytesPerAdd: number;
	walBytesPerRowMutation: number;
}>;

type AggregateProjectionName =
	| "realm_tag_judgment_stat"
	| "subject_association_judgment_stat"
	| "unit_structure_application_judgment_stat"
	| "unit_tag_judgment_stat";

type AggregateWriteOperationSummary = Readonly<{
	meanMillisecondsPerWrite: number;
	primaryWalMegabytesPerSecondAtTwentyThousandWrites: number;
	twoReplicaNetworkMegabytesPerSecondAtTwentyThousandWrites: number;
	walBytes: number;
	walBytesPerWrite: number;
	writes: number;
}>;

type AggregateMaintenanceSummary = Readonly<{
	delete: AggregateWriteOperationSummary;
	insertBranch: AggregateWriteOperationSummary;
	updateBranch: AggregateWriteOperationSummary;
}>;

type AggregateCapacityProjection = Readonly<{
	heapBytes: number;
	heapBytesPerRow: number;
	heapGiBAtFiveHundredMillionRows: number;
	heapGiBAtThreeBillionRows: number;
	indexBytes: number;
	indexBytesPerRow: number;
	indexGiBAtFiveHundredMillionRows: number;
	indexGiBAtThreeBillionRows: number;
	measuredRows: number;
	toastBytes: number;
	totalBytes: number;
	totalBytesPerRow: number;
	totalGiBAtFiveHundredMillionRows: number;
	totalGiBAtThreeBillionRows: number;
}>;

type RealHotKeyAuthority = "global" | "realm";

type RealHotKeyFixture = Readonly<{
	authority: RealHotKeyAuthority;
	contextPostIds?: readonly string[];
	pathLength: number;
	profileIds: readonly string[];
	realmId?: string;
	structureId?: string;
	tagIds: readonly string[];
	unitId: string;
}>;

type RealHotKeyAttemptOutcome = Readonly<{
	busyDecisionMilliseconds?: number;
	code?: string;
	constraint?: string;
	latencyMilliseconds: number;
	lockWaitMilliseconds: number;
	outcome: "backpressured" | "deadlock" | "other" | "succeeded" | "timedOut";
}>;

type LockWaitMonitor = Readonly<{
	readCumulativeMilliseconds: (pid: number) => number;
	stop: () => Promise<
		Readonly<{
			episodes: readonly number[];
			failed: boolean;
		}>
	>;
}>;

type RealHotKeyScenarioSummary = Readonly<{
	acceptance: Readonly<{
		attemptAccountingExact: boolean;
		minimumSuccessfulCommits: boolean;
		noDeadlocks: boolean;
		noLockWaitMonitorErrors: boolean;
		noPartialWrites: boolean;
		noPoolErrors: boolean;
		noPoolQueueing: boolean;
		noTimeouts: boolean;
		noUnexpectedErrors: boolean;
		passed: boolean;
		poolUtilizationBelowEightyPercent: boolean;
		serverConnectionCapacityAvailable: boolean;
		serverConnectionUtilizationBelowEightyPercent: boolean;
		successfulCommitsPerSecond: boolean;
		terminalAccountingExact: boolean;
		terminalP95BelowOneHundredFiftyMilliseconds: boolean;
		lockWaitP95BelowTwentyFiveMilliseconds: boolean;
	}>;
	activeClientConnectionsBefore: number;
	attemptLatency: LatencySummary;
	attemptedTransactions: number;
	authority: RealHotKeyAuthority;
	backpressuredAttempts: number;
	effectiveServerConnectionCapacity: number;
	busyDecisionLatency: LatencySummary;
	deadlocks: number;
	durationMilliseconds: number;
	lockWaitEpisodeLatency: LatencySummary;
	lockWaitMonitorFailed: boolean;
	logicalRequests: number;
	requestLockWaitLatency: LatencySummary;
	maximumPoolUtilization: number;
	maximumPoolConnectionsInUse: number;
	maximumPoolWaiting: number;
	maximumServerConnectionUtilization: number;
	otherErrors: number;
	poolErrors: number;
	parity: Readonly<{
		detail: string;
		passed: boolean;
	}>;
	pathLength: number;
	peakServerConnections: number;
	succeededRequests: number;
	successfulCommitsPerSecond: number;
	terminalBackpressuredRequests: number;
	terminalDeadlockRequests: number;
	terminalLatency: LatencySummary;
	terminalOtherErrorRequests: number;
	terminalTimedOutRequests: number;
	timedOutAttempts: number;
	unexpectedErrorExamples: readonly string[];
	walBytes: number;
	walBytesPerSuccessfulCommit: number | null;
}>;

type WriterFenceSummary = Readonly<{
	drain: Readonly<{
		blockedBeforeInFlightCommit: boolean;
		queuedWriterBlockedBehindPause: boolean;
		queuedWriterRejectedAfterPause: boolean;
		drainWaitMilliseconds: number;
		passed: boolean;
	}>;
	finalState: Readonly<{
		controlState: "paused";
		passed: boolean;
		requiresEpochBoundResume: true;
		transitionEpoch: number;
	}>;
	isolationGuard: Readonly<{
		passed: boolean;
		repeatableReadRejected: boolean;
		serializableRejected: boolean;
	}>;
	openState: Readonly<{
		baselineTransactionLatency: LatencySummary;
		baselineWalBytes: number;
		concurrency: number;
		fencedTransactionLatency: LatencySummary;
		fencedWalBytes: number;
		maximumPoolConnectionsInUse: number;
		maximumPoolUtilization: number;
		maximumPoolWaiting: number;
		passed: boolean;
		p95OverheadMilliseconds: number;
		sharedBarrierGrantedLocks: number;
		sharedBarrierPassed: boolean;
		samples: number;
		walOverheadBytes: number;
	}>;
}>;

type RealHotKeyBenchmarkSummary = Readonly<{
	acceptance: Readonly<{
		passed: boolean;
		reasons: readonly string[];
	}>;
	readiness: z.infer<typeof realHotKeyReadinessRow>;
	scenarios: readonly RealHotKeyScenarioSummary[];
	status: "failed" | "passed" | "pending";
	writerFence: WriterFenceSummary | null;
}>;

type ImporterEvidenceShapeName =
	| "content_pack_import"
	| "content_pack_structure_application_evidence"
	| "content_pack_structure_definition_evidence"
	| "content_pack_subject_association_evidence"
	| "content_pack_tag_evidence"
	| "content_pack_unit_tag_evidence";

type ImporterEvidenceLoadSummary = Readonly<{
	loadMilliseconds: number;
	walBytes: number;
	walBytesPerRow: number;
}>;

type ImporterEvidenceCapacitySummary = Readonly<{
	capacity: AggregateCapacityProjection;
	load: ImporterEvidenceLoadSummary;
}>;

function readPositiveIntegerFlag(name: string, fallback: number, maximum: number): number {
	const position = process.argv.indexOf(name);
	if (position < 0) return fallback;
	const value = Number(process.argv[position + 1]);
	if (!Number.isSafeInteger(value) || value < 1 || value > maximum)
		throw new RangeError(`${name} must be an integer between 1 and ${maximum}`);
	return value;
}

function readStringFlag(name: string): string | undefined {
	const position = process.argv.indexOf(name);
	if (position < 0) return undefined;
	const value = process.argv[position + 1];
	if (!value) throw new RangeError(`${name} requires a value`);
	return value;
}

function percentile(sorted: readonly number[], proportion: number): number {
	const index = Math.max(0, Math.ceil(sorted.length * proportion) - 1);
	return Number((sorted[index] ?? 0).toFixed(3));
}

function summarizeLatencies(latencies: readonly number[], timedOut: number): LatencySummary {
	const sorted = [...latencies].sort((left, right) => left - right);
	return {
		completed: sorted.length,
		maxMilliseconds: Number((sorted.at(-1) ?? 0).toFixed(3)),
		p50Milliseconds: percentile(sorted, 0.5),
		p95Milliseconds: percentile(sorted, 0.95),
		p99Milliseconds: percentile(sorted, 0.99),
		timedOut,
	};
}

function hasPostgresErrorCode(error: unknown, code: string): boolean {
	return typeof error === "object" && error !== null && "code" in error && error.code === code;
}

function summarizePlan(envelope: z.infer<typeof planEnvelope>): PlanSummary {
	const indexNames = new Set<string>();
	const nodeTypes = new Set<string>();
	let rowsRemovedByFilter = 0;
	const visit = (value: unknown): void => {
		if (typeof value !== "object" || value === null || Array.isArray(value)) return;
		const node = value as Record<string, unknown>;
		if (typeof node["Node Type"] === "string") nodeTypes.add(node["Node Type"]);
		if (typeof node["Index Name"] === "string") indexNames.add(node["Index Name"]);
		if (typeof node["Rows Removed by Filter"] === "number")
			rowsRemovedByFilter += node["Rows Removed by Filter"];
		if (Array.isArray(node.Plans)) for (const child of node.Plans) visit(child);
	};
	visit(envelope.Plan);
	return {
		executionMilliseconds: envelope["Execution Time"],
		indexNames: [...indexNames].sort(),
		nodeTypes: [...nodeTypes].sort(),
		planningMilliseconds: envelope["Planning Time"],
		rowsRemovedByFilter,
		sharedHitBlocks:
			typeof envelope.Plan["Shared Hit Blocks"] === "number"
				? envelope.Plan["Shared Hit Blocks"]
				: 0,
		sharedReadBlocks:
			typeof envelope.Plan["Shared Read Blocks"] === "number"
				? envelope.Plan["Shared Read Blocks"]
				: 0,
		sharedWrittenBlocks:
			typeof envelope.Plan["Shared Written Blocks"] === "number"
				? envelope.Plan["Shared Written Blocks"]
				: 0,
	};
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

async function currentLsn(client: Client): Promise<string> {
	return (await queryOne(client, lsnRow, "select pg_current_wal_lsn()::text as lsn")).lsn;
}

async function currentInsertLsn(client: Client): Promise<string> {
	return (await queryOne(client, lsnRow, "select pg_current_wal_insert_lsn()::text as lsn")).lsn;
}

async function readRealHotKeyReadiness(
	client: Client,
): Promise<z.infer<typeof realHotKeyReadinessRow>> {
	const catalog = await queryOne(
		client,
		realHotKeyCatalogReadinessRow,
		`select
			to_regclass('public.unit_structure_application_judgment') is not null
				as "globalTableInstalled",
			to_regclass('public.realm_tag_judgment') is not null as "realmTableInstalled",
			to_regclass('public.vndb_v11_cutover_control') is not null
				as "writerFenceInstalled",
			to_regprocedure(
				'public.lock_unit_structure_application_judgment_key(uuid,uuid)'
			) is not null
				and to_regprocedure(
					'public.lock_realm_tag_judgment_key(uuid,uuid,uuid)'
				) is not null
				and to_regprocedure(
					'public.lock_realm_tag_judgment_keys(uuid[],uuid[],uuid[])'
				) is not null
				and to_regprocedure(
					'public.lock_vndb_vote_hot_keys(uuid[],uuid[],uuid[])'
				) is not null
				and to_regprocedure('public.prepare_unit_tag_hot_key()') is not null
				and to_regprocedure('public.prepare_vndb_vote_hot_keys()') is not null
				and to_regprocedure('public.prepare_realm_tag_judgment_hot_key()')
					is not null as "functionInstalled",
			coalesce(
				pg_get_functiondef(to_regprocedure(
					'public.lock_vndb_vote_hot_keys(uuid[],uuid[],uuid[])'
				)) like '%pg_try_advisory_xact_lock%'
				and pg_get_functiondef(to_regprocedure(
					'public.lock_vndb_vote_hot_keys(uuid[],uuid[],uuid[])'
				)) like '%vndb_vote_hot_key_busy%',
				false
			) as "globalAdmissionIsFailFast",
			coalesce(
				pg_get_functiondef(to_regprocedure(
					'public.lock_vndb_vote_hot_keys(uuid[],uuid[],uuid[])'
				)) like '%cardinality(target_unit_ids) > 1024%'
				and pg_get_functiondef(to_regprocedure(
					'public.lock_vndb_vote_hot_keys(uuid[],uuid[],uuid[])'
				)) like '%vndb_vote_hot_key_batch_too_large%',
				false
			) as "globalAdmissionIsBounded",
			coalesce(
				pg_get_functiondef(to_regprocedure(
					'public.lock_realm_tag_judgment_keys(uuid[],uuid[],uuid[])'
				)) like '%pg_try_advisory_xact_lock%'
				and pg_get_functiondef(to_regprocedure(
					'public.lock_realm_tag_judgment_keys(uuid[],uuid[],uuid[])'
				)) like '%vndb_vote_hot_key_busy%',
				false
			) as "realmAdmissionIsFailFast",
			coalesce(
				pg_get_functiondef(to_regprocedure(
					'public.lock_realm_tag_judgment_keys(uuid[],uuid[],uuid[])'
				)) like '%cardinality(target_realm_ids) > 1024%'
				and pg_get_functiondef(to_regprocedure(
					'public.lock_realm_tag_judgment_keys(uuid[],uuid[],uuid[])'
				)) like '%vndb_vote_hot_key_batch_too_large%',
				false
			) as "realmAdmissionIsBounded",
			not exists (
				select 1
				from (
					values
						('public.content_pack_import', 'public.profile', null::name),
						('public.content_pack_tag_evidence', 'public.tag', null::name),
						(
							'public.content_pack_unit_tag_evidence',
							'public.unit_tag_judgment',
							'content_pack_unit_tag_evidence_judgment_fkey'::name
						),
						(
							'public.content_pack_structure_definition_evidence',
							'public.unit_structure_vote',
							'content_pack_structure_definition_evidence_vote_fkey'::name
						),
						(
							'public.content_pack_structure_application_evidence',
							'public.unit_structure_application_judgment',
							'content_pack_structure_application_evidence_judgment_fkey'::name
						),
						(
							'public.content_pack_subject_association_evidence',
							'public.subject_association_judgment',
							'content_pack_subject_association_evidence_judgment_fkey'::name
						)
				) as required(child_table, parent_table, constraint_name)
				where not exists (
					select 1
					from pg_constraint evidence_constraint
					where evidence_constraint.contype = 'f'
						and evidence_constraint.confdeltype = 'r'
						and evidence_constraint.conrelid =
							to_regclass(required.child_table)
						and evidence_constraint.confrelid =
							to_regclass(required.parent_table)
						and (
							required.constraint_name is null
							or evidence_constraint.conname = required.constraint_name
						)
				)
			) as "evidenceRetentionForeignKeysExact",
			(
				select count(*) = 6
				from pg_index evidence_index
				join pg_class evidence_index_relation
					on evidence_index_relation.oid = evidence_index.indexrelid
				join pg_namespace evidence_index_namespace
					on evidence_index_namespace.oid = evidence_index_relation.relnamespace
				where evidence_index_namespace.nspname = 'public'
					and evidence_index.indisvalid
					and evidence_index.indisready
					and evidence_index_relation.relname = any(array[
						'content_pack_import_profile_applied_idx',
						'content_pack_tag_evidence_tag_idx',
						'content_pack_unit_tag_evidence_judgment_idx',
						'content_pack_structure_definition_evidence_vote_idx',
						'content_pack_structure_application_evidence_judgment_idx',
						'content_pack_subject_association_evidence_judgment_idx'
					]::name[])
			) as "evidenceRetentionIndexesReady",
			count(*) filter (
				where (
					relation.relname = 'unit_structure_application_judgment'
					and trigger.tgname = 'unit_structure_application_judgment_hot_key_lock'
				) or (
					relation.relname = 'realm_tag_judgment'
					and trigger.tgname = 'realm_tag_judgment_hot_key_lock'
				)
			)::text
				as "hotKeyTriggerCount",
			count(*) filter (where trigger.tgname = 'vndb_v11_cutover_write_fence')::text
				as "fenceTriggerCount",
			(
				coalesce(array_agg(relation.relname::text order by relation.relname) filter (
					where trigger.tgname = 'vndb_v11_cutover_write_fence'
						and trigger.tgenabled in ('O', 'A')
						and trigger.tgtype = 62
						and trigger.tgfoid = to_regprocedure(
							'public.enforce_vndb_v11_cutover_write_fence()'
						)
				), array[]::text[]) = $1::text[]
				and count(*) filter (
					where trigger.tgname = 'vndb_v11_cutover_write_fence'
				) = cardinality($1::text[])
			) as "fenceInventoryExact",
			coalesce(bool_or(
				relation.relname = 'unit_structure_application_judgment'
				and trigger.tgname = 'unit_structure_application_judgment_hot_key_lock'
				and trigger.tgenabled in ('O', 'A')
				and trigger.tgtype = 31
				and trigger.tgfoid = to_regprocedure(
					'public.prepare_structure_application_judgment_hot_keys()'
				)
			), false) as "globalAdmissionTriggerInstalled",
			coalesce(bool_or(
				relation.relname = 'realm_tag_judgment'
				and trigger.tgname = 'realm_tag_judgment_hot_key_lock'
				and trigger.tgenabled in ('O', 'A')
				and trigger.tgtype = 31
				and trigger.tgfoid = to_regprocedure(
					'public.prepare_realm_tag_judgment_hot_key()'
				)
			), false) as "realmAdmissionTriggerInstalled",
			coalesce(bool_or(
				relation.relname = 'unit_tag'
					and trigger.tgname = 'unit_tag_hot_key_lock'
					and trigger.tgenabled in ('O', 'A')
					and trigger.tgtype = 15
					and trigger.tgfoid = to_regprocedure(
						'public.prepare_unit_tag_hot_key()'
					)
			), false) as "unitTagAdmissionTriggerInstalled",
			coalesce(bool_or(
				relation.relname = 'unit_tag_judgment'
					and trigger.tgname = 'unit_tag_judgment_hot_key_lock'
					and trigger.tgenabled in ('O', 'A')
					and trigger.tgtype = 31
					and trigger.tgfoid = to_regprocedure(
						'public.prepare_vndb_vote_hot_keys()'
					)
			), false) as "unitTagJudgmentAdmissionTriggerInstalled",
			coalesce(bool_or(
				relation.relname = 'unit_structure_application_judgment'
				and trigger.tgname = 'vndb_v11_cutover_write_fence'
				and trigger.tgenabled in ('O', 'A')
				and trigger.tgtype = 62
				and trigger.tgfoid = to_regprocedure(
					'public.enforce_vndb_v11_cutover_write_fence()'
				)
			), false) as "globalFenceTriggerInstalled",
			coalesce(bool_or(
				relation.relname = 'realm_tag_judgment'
				and trigger.tgname = 'vndb_v11_cutover_write_fence'
				and trigger.tgenabled in ('O', 'A')
				and trigger.tgtype = 62
				and trigger.tgfoid = to_regprocedure(
					'public.enforce_vndb_v11_cutover_write_fence()'
				)
			), false) as "realmFenceTriggerInstalled"
			,coalesce(
				pg_get_functiondef(
					to_regprocedure('public.enforce_vndb_v11_cutover_write_fence()')
				) like '%pg_advisory_xact_lock_shared(71011001::bigint)%',
				false
			) as "writerFenceUsesFixedAdvisoryKey"
			,coalesce((
				select
					strpos(body, 'vndb_v11_cutover_read_committed_required') > 0
					and strpos(body, 'pg_advisory_xact_lock_shared(71011001::bigint)') > 0
					and strpos(body, 'vndb_v11_cutover_read_committed_required')
						< strpos(body, 'pg_advisory_xact_lock_shared(71011001::bigint)')
					and strpos(body, 'pg_advisory_xact_lock_shared(71011001::bigint)')
						< strpos(body, 'selectstate')
				from (
					select regexp_replace(
						lower(pg_get_functiondef(to_regprocedure(
							'public.enforce_vndb_v11_cutover_write_fence()'
						))), '\\s+', '', 'g'
					) as body
				) normalized
			), false) as "writerFenceBodyOrderValid"
			,coalesce(
				pg_get_functiondef(
					to_regprocedure('public.enforce_vndb_v11_cutover_control_transition()')
				) like '%pg_advisory_xact_lock(71011001::bigint)%',
				false
			) as "writerFenceTransitionUsesExclusiveKey"
		 from pg_catalog.pg_trigger as trigger
		 join pg_catalog.pg_class as relation on relation.oid = trigger.tgrelid
		 join pg_catalog.pg_namespace as namespace on namespace.oid = relation.relnamespace
		 where namespace.nspname = 'public' and not trigger.tgisinternal`,
		[[...FinalWriterFenceTableNames]],
	);
	if (!catalog.writerFenceInstalled) return { ...catalog, controlState: null };
	const { controlState } = await queryOne(
		client,
		cutoverControlStateRow,
		`select state as "controlState"
		 from public.vndb_v11_cutover_control
		 where id = 1`,
	);
	return { ...catalog, controlState };
}

export function realHotKeySchemaReady(readiness: z.infer<typeof realHotKeyReadinessRow>): boolean {
	return (
		readiness.controlState === "postcontract_open" &&
		readiness.evidenceRetentionForeignKeysExact &&
		readiness.evidenceRetentionIndexesReady &&
		readiness.functionInstalled &&
		readiness.globalAdmissionIsBounded &&
		readiness.globalAdmissionIsFailFast &&
		readiness.globalAdmissionTriggerInstalled &&
		readiness.globalFenceTriggerInstalled &&
		readiness.globalTableInstalled &&
		readiness.realmAdmissionIsBounded &&
		readiness.realmAdmissionIsFailFast &&
		readiness.realmAdmissionTriggerInstalled &&
		readiness.realmFenceTriggerInstalled &&
		readiness.realmTableInstalled &&
		readiness.unitTagAdmissionTriggerInstalled &&
		readiness.unitTagJudgmentAdmissionTriggerInstalled &&
		readiness.writerFenceInstalled &&
		readiness.writerFenceBodyOrderValid &&
		readiness.writerFenceTransitionUsesExclusiveKey &&
		readiness.writerFenceUsesFixedAdvisoryKey &&
		readiness.hotKeyTriggerCount === 2 &&
		readiness.fenceTriggerCount === FinalWriterFenceTableNames.length &&
		readiness.fenceInventoryExact
	);
}

async function walBytesBetween(client: Client, start: string, end: string): Promise<number> {
	return (
		await queryOne(
			client,
			walDifferenceRow,
			"select pg_wal_lsn_diff($2::pg_lsn, $1::pg_lsn)::text as bytes",
			[start, end],
		)
	).bytes;
}

async function explain(
	client: Client,
	query: string,
	parameters: readonly unknown[] = [],
): Promise<PlanSummary> {
	const row = await queryOne(
		client,
		explainRow,
		`explain (analyze, buffers, wal, format json) ${query}`,
		parameters,
	);
	const envelope = row["QUERY PLAN"][0];
	if (!envelope) throw new Error("PostgreSQL returned an empty plan envelope");
	return summarizePlan(envelope);
}

function requireIndex(name: string, plan: PlanSummary, ...indexNames: readonly string[]): void {
	if (!indexNames.some((indexName) => plan.indexNames.includes(indexName)))
		throw new Error(`${name} did not use one of the required indexes: ${indexNames.join(", ")}`);
}

async function createFixture(
	client: Client,
	rowCount: number,
): Promise<{
	readonly coLocatedLoadMilliseconds: number;
	readonly coLocatedLoadWalBytes: number;
	readonly splitLoadMilliseconds: number;
	readonly splitLoadWalBytes: number;
}> {
	await client.query(`drop schema if exists ${FixtureSchema} cascade`);
	await client.query(`create schema ${FixtureSchema}`);
	await client.query(`
		create table ${FixtureSchema}.co_judgment (
			unit_id uuid not null,
			target_id uuid not null,
			profile_id uuid not null,
			fit_vote smallint,
			spoiler_level smallint,
			fit_updated_at timestamptz,
			spoiler_updated_at timestamptz,
			created_at timestamptz not null default now(),
			updated_at timestamptz not null default now(),
			primary key (unit_id, target_id, profile_id),
			constraint co_judgment_fit_check check (fit_vote in (-1, 1)),
			constraint co_judgment_spoiler_check check (spoiler_level between 0 and 2),
			constraint co_judgment_sparse_check check (fit_vote is not null or spoiler_level is not null),
			constraint co_judgment_fit_timestamp_check check ((fit_vote is null) = (fit_updated_at is null)),
			constraint co_judgment_spoiler_timestamp_check check ((spoiler_level is null) = (spoiler_updated_at is null))
		);
		create index co_judgment_target_idx
			on ${FixtureSchema}.co_judgment (target_id, unit_id);
		create index co_judgment_profile_idx
			on ${FixtureSchema}.co_judgment (profile_id, unit_id, target_id);

		create table ${FixtureSchema}.split_fit_judgment (
			unit_id uuid not null,
			target_id uuid not null,
			profile_id uuid not null,
			fit_vote smallint not null check (fit_vote in (-1, 1)),
			created_at timestamptz not null,
			updated_at timestamptz not null,
			primary key (unit_id, target_id, profile_id)
		);
		create index split_fit_judgment_target_idx
			on ${FixtureSchema}.split_fit_judgment (target_id, unit_id);
		create index split_fit_judgment_profile_idx
			on ${FixtureSchema}.split_fit_judgment (profile_id, unit_id, target_id);

		create table ${FixtureSchema}.split_spoiler_judgment (
			unit_id uuid not null,
			target_id uuid not null,
			profile_id uuid not null,
			spoiler_level smallint not null check (spoiler_level between 0 and 2),
			created_at timestamptz not null,
			updated_at timestamptz not null,
			primary key (unit_id, target_id, profile_id)
		);
		create index split_spoiler_judgment_target_idx
			on ${FixtureSchema}.split_spoiler_judgment (target_id, unit_id);
		create index split_spoiler_judgment_profile_idx
			on ${FixtureSchema}.split_spoiler_judgment (profile_id, unit_id, target_id);
	`);

	const coStartLsn = await currentLsn(client);
	const coStartedAt = performance.now();
	await client.query(
		`insert into ${FixtureSchema}.co_judgment (
			unit_id, target_id, profile_id, fit_vote, spoiler_level,
			fit_updated_at, spoiler_updated_at, created_at, updated_at
		)
		with source as (
			select ordinal,
				case
					when ordinal <= 539455 then ordinal
					when ordinal <= 889455 then ordinal - 539455
					when ordinal <= 979455 then 1 + ((ordinal - 889456) % 50000)
					else 1 + ((ordinal - 979456) % 1000)
				end as relationship_ordinal
			from generate_series(1, $1::integer) ordinal
		), shaped as (
			select ordinal,
				md5('vndb-capacity-unit:' || relationship_ordinal)::uuid as unit_id,
				md5('vndb-capacity-target:' || (
					1 + floor(power(
						((relationship_ordinal * 48271::bigint) % 1000003)::numeric / 1000003,
						3
					) * 1562)
				)::text)::uuid as target_id,
				md5('vndb-capacity-profile:' || (
					1 + ((ordinal * 7919::bigint + relationship_ordinal) % 4414)
				)::text)::uuid as profile_id
			from source
		)
		select unit_id, target_id, profile_id,
			case when ordinal % 1000 >= 50 then
				case when ordinal % 20 = 0 then -1 else 1 end
			end as fit_vote,
			case when ordinal % 1000 < 388 then
				case
					when ordinal % 10000 < 8312 then 0
					when ordinal % 10000 < 9200 then 1
					else 2
				end
			end as spoiler_level,
			case when ordinal % 1000 >= 50 then now() end as fit_updated_at,
			case when ordinal % 1000 < 388 then now() end as spoiler_updated_at,
			now(), now()
		from shaped
		on conflict (unit_id, target_id, profile_id) do nothing`,
		[rowCount],
	);
	const coLocatedLoadMilliseconds = Math.round(performance.now() - coStartedAt);
	const coEndLsn = await currentLsn(client);

	const splitStartLsn = coEndLsn;
	const splitStartedAt = performance.now();
	await client.query(`
		insert into ${FixtureSchema}.split_fit_judgment
		select unit_id, target_id, profile_id, fit_vote, created_at, fit_updated_at
		from ${FixtureSchema}.co_judgment where fit_vote is not null;
		insert into ${FixtureSchema}.split_spoiler_judgment
		select unit_id, target_id, profile_id, spoiler_level, created_at, spoiler_updated_at
		from ${FixtureSchema}.co_judgment where spoiler_level is not null;
	`);
	const splitLoadMilliseconds = Math.round(performance.now() - splitStartedAt);
	const splitEndLsn = await currentLsn(client);
	for (const table of ["co_judgment", "split_fit_judgment", "split_spoiler_judgment"])
		await client.query(`analyze ${FixtureSchema}.${table}`);
	return {
		coLocatedLoadMilliseconds,
		coLocatedLoadWalBytes: await walBytesBetween(client, coStartLsn, coEndLsn),
		splitLoadMilliseconds,
		splitLoadWalBytes: await walBytesBetween(client, splitStartLsn, splitEndLsn),
	};
}

async function createRelationShapes(client: Client, rowCount: number): Promise<number> {
	const startedAt = performance.now();
	await client.query(`
		create table ${FixtureSchema}.realm_application_judgment (
			realm_id uuid not null, unit_id uuid not null, target_id uuid not null,
			profile_id uuid not null, fit_vote smallint, spoiler_level smallint,
			fit_updated_at timestamptz, spoiler_updated_at timestamptz,
			created_at timestamptz not null, updated_at timestamptz not null,
			primary key (realm_id, unit_id, target_id, profile_id),
			check (fit_vote is not null or spoiler_level is not null)
		);
		create index realm_application_judgment_target_idx
			on ${FixtureSchema}.realm_application_judgment (realm_id, target_id, unit_id);
		create index realm_application_judgment_profile_idx
			on ${FixtureSchema}.realm_application_judgment (profile_id, realm_id, unit_id);

		create table ${FixtureSchema}.global_definition_vote (
			structure_id uuid not null, profile_id uuid not null, value smallint not null,
			created_at timestamptz not null, updated_at timestamptz not null,
			primary key (structure_id, profile_id)
		);
		create index global_definition_vote_profile_idx
			on ${FixtureSchema}.global_definition_vote (profile_id, structure_id);

		create table ${FixtureSchema}.realm_definition_vote (
			realm_id uuid not null, structure_id uuid not null, profile_id uuid not null,
			value smallint not null, created_at timestamptz not null, updated_at timestamptz not null,
			primary key (realm_id, structure_id, profile_id)
		);
		create index realm_definition_vote_profile_idx
			on ${FixtureSchema}.realm_definition_vote (profile_id, realm_id, structure_id);

		create table ${FixtureSchema}.association_judgment (
			association_id uuid not null, profile_id uuid not null, spoiler_level smallint not null,
			created_at timestamptz not null, updated_at timestamptz not null,
			primary key (association_id, profile_id)
		);
		create index association_judgment_profile_idx
			on ${FixtureSchema}.association_judgment (profile_id, association_id);

		create table ${FixtureSchema}.global_support (
			unit_id uuid not null, tag_id uuid not null, profile_id uuid not null, structure_id uuid not null,
			created_at timestamptz not null,
			primary key (unit_id, tag_id, profile_id, structure_id)
		);
		create index global_support_structure_idx
			on ${FixtureSchema}.global_support (structure_id, unit_id, profile_id);

		create table ${FixtureSchema}.realm_support (
			realm_id uuid not null, unit_id uuid not null, tag_id uuid not null,
			profile_id uuid not null, structure_id uuid not null, created_at timestamptz not null,
			primary key (realm_id, unit_id, tag_id, profile_id, structure_id)
		);
		create index realm_support_structure_idx
			on ${FixtureSchema}.realm_support (realm_id, structure_id, unit_id, profile_id);

		create table ${FixtureSchema}.global_effective_tag (
			unit_id uuid not null, tag_id uuid not null, direct boolean not null,
			structure_support_count bigint not null, updated_at timestamptz not null,
			primary key (unit_id, tag_id)
		);
		create index global_effective_tag_tag_idx
			on ${FixtureSchema}.global_effective_tag (tag_id, unit_id);

		create table ${FixtureSchema}.realm_effective_tag (
			realm_id uuid not null, unit_id uuid not null, tag_id uuid not null,
			direct boolean not null, structure_support_count bigint not null,
			updated_at timestamptz not null,
			primary key (realm_id, unit_id, tag_id)
		);
		create index realm_effective_tag_tag_idx
			on ${FixtureSchema}.realm_effective_tag (realm_id, tag_id, unit_id);

		create table ${FixtureSchema}.structure_ends_at (
			structure_id uuid primary key, final_tag_id uuid not null
		);
		create index structure_ends_at_tag_idx
			on ${FixtureSchema}.structure_ends_at (final_tag_id, structure_id);

		create table ${FixtureSchema}.primary_display_path (
			tag_id uuid primary key, structure_id uuid not null, updated_at timestamptz not null
		);
		create index primary_display_path_structure_idx
			on ${FixtureSchema}.primary_display_path (structure_id, tag_id);

		create table ${FixtureSchema}.entity_measurement (
			entity_id uuid not null, context_unit_id uuid,
			height_millimetres integer, weight_grams integer,
			bust_millimetres integer, waist_millimetres integer, hips_millimetres integer,
			source_url text not null, source_imported_at timestamptz not null,
			source_provenance jsonb not null,
			unique nulls not distinct (entity_id, context_unit_id)
		);
		create index entity_measurement_context_idx
			on ${FixtureSchema}.entity_measurement (context_unit_id, entity_id)
			where context_unit_id is not null;

		create table ${FixtureSchema}.unit_tag_judgment_stat (
			unit_id uuid not null, tag_id uuid not null,
			score bigint not null, vote_count bigint not null,
			spoiler_vote_count bigint not null, spoiler_none_count bigint not null,
			spoiler_minor_count bigint not null, spoiler_major_count bigint not null,
			updated_at timestamptz(3) not null,
			primary key (unit_id, tag_id),
			check (vote_count >= 0 and abs(score) <= vote_count),
			check ((vote_count + score) % 2 = 0),
			check (spoiler_vote_count >= 0 and spoiler_none_count >= 0
				and spoiler_minor_count >= 0 and spoiler_major_count >= 0),
			check (spoiler_vote_count = spoiler_none_count + spoiler_minor_count
				+ spoiler_major_count)
		);

		create table ${FixtureSchema}.unit_structure_application_judgment_stat (
			unit_id uuid not null, structure_id uuid not null,
			score bigint not null, vote_count bigint not null,
			spoiler_vote_count bigint not null, spoiler_none_count bigint not null,
			spoiler_minor_count bigint not null, spoiler_major_count bigint not null,
			updated_at timestamptz(3) not null,
			primary key (unit_id, structure_id),
			check (vote_count >= 0 and abs(score) <= vote_count),
			check ((vote_count + score) % 2 = 0),
			check (spoiler_vote_count >= 0 and spoiler_none_count >= 0
				and spoiler_minor_count >= 0 and spoiler_major_count >= 0),
			check (spoiler_vote_count = spoiler_none_count + spoiler_minor_count
				+ spoiler_major_count)
		);

		create table ${FixtureSchema}.realm_tag_judgment_stat (
			realm_id uuid not null, unit_id uuid not null, tag_id uuid not null,
			score bigint not null, vote_count bigint not null,
			spoiler_vote_count bigint not null, spoiler_none_count bigint not null,
			spoiler_minor_count bigint not null, spoiler_major_count bigint not null,
			updated_at timestamptz(3) not null,
			primary key (realm_id, unit_id, tag_id),
			check (vote_count >= 0 and abs(score) <= vote_count),
			check ((vote_count + score) % 2 = 0),
			check (spoiler_vote_count >= 0 and spoiler_none_count >= 0
				and spoiler_minor_count >= 0 and spoiler_major_count >= 0),
			check (spoiler_vote_count = spoiler_none_count + spoiler_minor_count
				+ spoiler_major_count)
		);
		create index realm_tag_judgment_stat_realm_tag_unit_idx
			on ${FixtureSchema}.realm_tag_judgment_stat (realm_id, tag_id, unit_id);
		create index realm_tag_judgment_stat_unit_realm_tag_idx
			on ${FixtureSchema}.realm_tag_judgment_stat (unit_id, realm_id, tag_id);
		create index realm_tag_judgment_stat_tag_realm_unit_idx
			on ${FixtureSchema}.realm_tag_judgment_stat (tag_id, realm_id, unit_id);

		create table ${FixtureSchema}.subject_association_judgment_stat (
			association_id uuid primary key,
			spoiler_vote_count bigint not null, spoiler_none_count bigint not null,
			spoiler_minor_count bigint not null, spoiler_major_count bigint not null,
			updated_at timestamptz(3) not null,
			check (spoiler_vote_count >= 0 and spoiler_none_count >= 0
				and spoiler_minor_count >= 0 and spoiler_major_count >= 0),
			check (spoiler_vote_count = spoiler_none_count + spoiler_minor_count
				+ spoiler_major_count)
		);

		create table ${FixtureSchema}.unit_structure_primary_path_candidate (
			structure_id uuid not null,
			projection_version integer not null,
			final_tag_id uuid not null,
			accepted boolean not null,
			wilson_lower_bound double precision not null,
			score bigint not null,
			vote_count bigint not null,
			updated_at timestamptz(3) not null,
			primary key (structure_id, projection_version)
		);
		create index unit_structure_primary_path_candidate_rank_idx
			on ${FixtureSchema}.unit_structure_primary_path_candidate
			(final_tag_id, wilson_lower_bound desc, score desc, vote_count desc,
			 structure_id, projection_version) where accepted;

		create table ${FixtureSchema}.skew_unit_tag_judgment (
			unit_id uuid not null, tag_id uuid not null, profile_id uuid not null,
			fit_vote integer, spoiler_level smallint,
			primary key (unit_id, tag_id, profile_id)
		);

		create table ${FixtureSchema}.skew_structure_application_judgment (
			unit_id uuid not null, structure_id uuid not null, profile_id uuid not null,
			fit_vote integer, spoiler_level smallint,
			primary key (unit_id, structure_id, profile_id)
		);

		create table ${FixtureSchema}.skew_realm_tag_judgment (
			realm_id uuid not null, unit_id uuid not null, tag_id uuid not null,
			profile_id uuid not null, fit_vote integer, spoiler_level smallint,
			primary key (realm_id, unit_id, tag_id, profile_id)
		);

		create table ${FixtureSchema}.skew_subject_association_judgment (
			association_id uuid not null, profile_id uuid not null,
			spoiler_level smallint not null,
			primary key (association_id, profile_id)
		);

		create table ${FixtureSchema}.skew_structure_support (
			unit_id uuid not null, tag_id uuid not null, profile_id uuid not null,
			structure_id uuid not null,
			primary key (unit_id, tag_id, profile_id, structure_id)
		);
		create index skew_structure_support_effective_vote_idx
			on ${FixtureSchema}.skew_structure_support (unit_id, tag_id, profile_id);
		create index skew_structure_support_structure_idx
			on ${FixtureSchema}.skew_structure_support (structure_id, unit_id, profile_id);
	`);
	await client.query(
		`insert into ${FixtureSchema}.realm_application_judgment
		select md5('realm:' || (1 + ordinal % 1000))::uuid,
			md5('unit:' || ordinal)::uuid, md5('target:' || (1 + ordinal % 1562))::uuid,
			md5('profile:' || (1 + ordinal % 4414))::uuid,
			case when ordinal % 1000 >= 50 then 1 end,
			case when ordinal % 1000 < 388 then ordinal % 3 end,
			case when ordinal % 1000 >= 50 then now() end,
			case when ordinal % 1000 < 388 then now() end,
			now(), now()
		from generate_series(1, $1::integer) ordinal`,
		[rowCount],
	);
	await client.query(
		`insert into ${FixtureSchema}.global_definition_vote
		select md5('structure:' || ordinal)::uuid,
			md5('profile:' || (1 + ordinal % 4414))::uuid,
			case when ordinal % 20 = 0 then -1 else 1 end, now(), now()
		from generate_series(1, $1::integer) ordinal`,
		[rowCount],
	);
	const shapeInserts = [
		`insert into ${FixtureSchema}.realm_definition_vote
		select md5('realm:' || (1 + ordinal % 1000))::uuid,
			md5('structure:' || ordinal)::uuid,
			md5('profile:' || (1 + ordinal % 4414))::uuid,
			case when ordinal % 20 = 0 then -1 else 1 end, now(), now()
		from generate_series(1, $1::integer) ordinal`,
		`insert into ${FixtureSchema}.association_judgment
		select md5('association:' || ordinal)::uuid,
			md5('profile:' || (1 + ordinal % 4414))::uuid,
			ordinal % 3, now(), now()
		from generate_series(1, $1::integer) ordinal`,
		`insert into ${FixtureSchema}.global_support
		select md5('unit:' || ordinal)::uuid, md5('tag:' || (1 + ordinal % 1562))::uuid,
			md5('profile:' || (1 + ordinal % 4414))::uuid,
			md5('structure:' || ordinal)::uuid, now()
		from generate_series(1, $1::integer) ordinal`,
		`insert into ${FixtureSchema}.realm_support
		select md5('realm:' || (1 + ordinal % 1000))::uuid,
			md5('unit:' || ordinal)::uuid, md5('tag:' || (1 + ordinal % 1562))::uuid,
			md5('profile:' || (1 + ordinal % 4414))::uuid,
			md5('structure:' || ordinal)::uuid, now()
		from generate_series(1, $1::integer) ordinal`,
		`insert into ${FixtureSchema}.global_effective_tag
		select md5('unit:' || ordinal)::uuid, md5('tag:' || (1 + ordinal % 1562))::uuid,
			ordinal % 3 = 0, 1 + ordinal % 4, now()
		from generate_series(1, $1::integer) ordinal`,
		`insert into ${FixtureSchema}.realm_effective_tag
		select md5('realm:' || (1 + ordinal % 1000))::uuid,
			md5('unit:' || ordinal)::uuid, md5('tag:' || (1 + ordinal % 1562))::uuid,
			ordinal % 3 = 0, 1 + ordinal % 4, now()
		from generate_series(1, $1::integer) ordinal`,
		`insert into ${FixtureSchema}.structure_ends_at
		select md5('structure:' || ordinal)::uuid, md5('tag:' || (1 + ordinal % 1562))::uuid
		from generate_series(1, $1::integer) ordinal`,
		`insert into ${FixtureSchema}.primary_display_path
		select md5('tag-primary:' || ordinal)::uuid, md5('structure:' || ordinal)::uuid, now()
		from generate_series(1, $1::integer) ordinal`,
		`insert into ${FixtureSchema}.entity_measurement
		select md5('entity:' || (1 + ((ordinal - 1) / 9)))::uuid,
			case when ordinal % 9 = 1 then null else md5('context:' || ordinal)::uuid end,
			1500 + ordinal % 500, 40000 + ordinal % 80000,
			case when ordinal % 3 = 0 then 700 + ordinal % 300 end,
			case when ordinal % 3 = 0 then 500 + ordinal % 200 end,
			case when ordinal % 3 = 0 then 700 + ordinal % 300 end,
			'https://vndb.org/c' || ordinal, now(),
			jsonb_build_object('source', 'vndb', 'sourceId', 'c' || ordinal)
		from generate_series(1, $1::integer) ordinal`,
		`insert into ${FixtureSchema}.unit_tag_judgment_stat
		select md5('stat-unit:' || ordinal)::uuid,
			md5('stat-tag:' || (1 + ordinal % 1562))::uuid,
			case when ordinal % 20 = 0 then -1 else 1 end, 1,
			case when ordinal % 1000 < 388 then 1 else 0 end,
			case when ordinal % 1000 < 388 and ordinal % 3 = 0 then 1 else 0 end,
			case when ordinal % 1000 < 388 and ordinal % 3 = 1 then 1 else 0 end,
			case when ordinal % 1000 < 388 and ordinal % 3 = 2 then 1 else 0 end,
			now()
		from generate_series(1, $1::integer) ordinal`,
		`insert into ${FixtureSchema}.unit_structure_application_judgment_stat
		select md5('stat-unit:' || ordinal)::uuid,
			md5('stat-structure:' || ordinal)::uuid,
			case when ordinal % 20 = 0 then -1 else 1 end, 1,
			case when ordinal % 1000 < 388 then 1 else 0 end,
			case when ordinal % 1000 < 388 and ordinal % 3 = 0 then 1 else 0 end,
			case when ordinal % 1000 < 388 and ordinal % 3 = 1 then 1 else 0 end,
			case when ordinal % 1000 < 388 and ordinal % 3 = 2 then 1 else 0 end,
			now()
		from generate_series(1, $1::integer) ordinal`,
		`insert into ${FixtureSchema}.realm_tag_judgment_stat
		select md5('stat-realm:' || (1 + ordinal % 1000))::uuid,
			md5('stat-unit:' || ordinal)::uuid,
			md5('stat-tag:' || (1 + ordinal % 1562))::uuid,
			case when ordinal % 20 = 0 then -1 else 1 end, 1,
			case when ordinal % 1000 < 388 then 1 else 0 end,
			case when ordinal % 1000 < 388 and ordinal % 3 = 0 then 1 else 0 end,
			case when ordinal % 1000 < 388 and ordinal % 3 = 1 then 1 else 0 end,
			case when ordinal % 1000 < 388 and ordinal % 3 = 2 then 1 else 0 end,
			now()
		from generate_series(1, $1::integer) ordinal`,
		`insert into ${FixtureSchema}.subject_association_judgment_stat
		select md5('stat-association:' || ordinal)::uuid,
			1,
			case when ordinal % 3 = 0 then 1 else 0 end,
			case when ordinal % 3 = 1 then 1 else 0 end,
			case when ordinal % 3 = 2 then 1 else 0 end,
			now()
		from generate_series(1, $1::integer) ordinal`,
		`insert into ${FixtureSchema}.unit_structure_primary_path_candidate
		select md5('primary-candidate:' || ordinal)::uuid, 1,
			md5('primary-candidate-hot-final')::uuid, true,
			((ordinal % 10000)::double precision / 10000),
			1 + ordinal % 200, 1 + ordinal % 250, now()
		from generate_series(1, $1::integer) ordinal`,
		`insert into ${FixtureSchema}.skew_unit_tag_judgment
		select md5('skew-unit-tag-unit')::uuid, md5('skew-unit-tag-tag')::uuid,
			md5('skew-profile:' || ordinal)::uuid, 1, ordinal % 3
		from generate_series(1, $1::integer) ordinal`,
		`insert into ${FixtureSchema}.skew_structure_application_judgment
		select md5('skew-structure-unit')::uuid, md5('skew-structure')::uuid,
			md5('skew-profile:' || ordinal)::uuid, 1, ordinal % 3
		from generate_series(1, $1::integer) ordinal`,
		`insert into ${FixtureSchema}.skew_realm_tag_judgment
		select md5('skew-realm')::uuid, md5('skew-realm-unit')::uuid,
			md5('skew-realm-tag')::uuid, md5('skew-profile:' || ordinal)::uuid,
			1, ordinal % 3
		from generate_series(1, $1::integer) ordinal`,
		`insert into ${FixtureSchema}.skew_subject_association_judgment
		select md5('skew-association')::uuid, md5('skew-profile:' || ordinal)::uuid,
			ordinal % 3
		from generate_series(1, $1::integer) ordinal`,
		`insert into ${FixtureSchema}.skew_structure_support
		select md5('skew-support-unit')::uuid, md5('skew-support-tag')::uuid,
			md5('skew-profile:' || ((ordinal - 1) % 1000))::uuid,
			md5('skew-path:' || ((ordinal - 1) / 1000))::uuid
		from generate_series(1, $1::integer) ordinal`,
	];
	for (const shapeInsert of shapeInserts) await client.query(shapeInsert, [rowCount]);
	const tables = [
		"realm_application_judgment",
		"global_definition_vote",
		"realm_definition_vote",
		"association_judgment",
		"global_support",
		"realm_support",
		"global_effective_tag",
		"realm_effective_tag",
		"structure_ends_at",
		"primary_display_path",
		"entity_measurement",
		"unit_tag_judgment_stat",
		"unit_structure_application_judgment_stat",
		"realm_tag_judgment_stat",
		"subject_association_judgment_stat",
		"unit_structure_primary_path_candidate",
		"skew_unit_tag_judgment",
		"skew_structure_application_judgment",
		"skew_realm_tag_judgment",
		"skew_subject_association_judgment",
		"skew_structure_support",
	];
	for (const table of tables) await client.query(`analyze ${FixtureSchema}.${table}`);
	return Math.round(performance.now() - startedAt);
}

async function relationSizes(client: Client): Promise<readonly z.infer<typeof relationSizeRow>[]> {
	const result = await client.query(
		`
		select relation.relname as "tableName",
			pg_relation_size(relation.oid)::text as "heapBytes",
			pg_indexes_size(relation.oid)::text as "indexBytes",
			(pg_total_relation_size(relation.oid)
				- pg_relation_size(relation.oid)
				- pg_indexes_size(relation.oid))::text as "toastBytes",
			pg_total_relation_size(relation.oid)::text as "totalBytes",
			relation.reltuples::text as "rowEstimate"
		from pg_class relation
		join pg_namespace namespace on namespace.oid = relation.relnamespace
		where namespace.nspname = $1 and relation.relkind = 'r'
		order by relation.relname
	`,
		[FixtureSchema],
	);
	return z.array(relationSizeRow).parse(result.rows);
}

function requireRelationSize(
	byName: ReadonlyMap<string, z.infer<typeof relationSizeRow>>,
	name: string,
): z.infer<typeof relationSizeRow> {
	const row = byName.get(name);
	if (!row) throw new Error(`Relation size evidence is missing for ${name}`);
	return row;
}

function aggregateCapacityProjection(
	row: z.infer<typeof relationSizeRow>,
): AggregateCapacityProjection {
	if (row.rowEstimate <= 0)
		throw new Error(`${row.tableName} must have a positive analyzed row estimate`);
	const heapBytesPerRow = row.heapBytes / row.rowEstimate;
	const indexBytesPerRow = row.indexBytes / row.rowEstimate;
	const totalBytesPerRow = row.totalBytes / row.rowEstimate;
	const gibAt = (bytesPerRow: number, rows: number): number =>
		Number(((bytesPerRow * rows) / 1024 ** 3).toFixed(3));
	return {
		heapBytes: row.heapBytes,
		heapBytesPerRow: Number(heapBytesPerRow.toFixed(3)),
		heapGiBAtFiveHundredMillionRows: gibAt(heapBytesPerRow, 500_000_000),
		heapGiBAtThreeBillionRows: gibAt(heapBytesPerRow, 3_000_000_000),
		indexBytes: row.indexBytes,
		indexBytesPerRow: Number(indexBytesPerRow.toFixed(3)),
		indexGiBAtFiveHundredMillionRows: gibAt(indexBytesPerRow, 500_000_000),
		indexGiBAtThreeBillionRows: gibAt(indexBytesPerRow, 3_000_000_000),
		measuredRows: row.rowEstimate,
		toastBytes: row.toastBytes,
		totalBytes: row.totalBytes,
		totalBytesPerRow: Number(totalBytesPerRow.toFixed(3)),
		totalGiBAtFiveHundredMillionRows: gibAt(totalBytesPerRow, 500_000_000),
		totalGiBAtThreeBillionRows: gibAt(totalBytesPerRow, 3_000_000_000),
	};
}

async function runHotKeyTier(
	connectionString: string,
	concurrency: number,
	sampleCount: number,
	realmScoped: boolean,
): Promise<LatencySummary> {
	const clients = Array.from({ length: concurrency }, () => new Client({ connectionString }));
	await Promise.all(clients.map((client) => client.connect()));
	let nextSample = 0;
	let timedOut = 0;
	const latencies: number[] = [];
	try {
		await Promise.all(clients.map((client) => client.query("set statement_timeout = '1500ms'")));
		await Promise.all(
			clients.map(async (client, worker) => {
				while (nextSample < sampleCount) {
					const sample = nextSample++;
					const startedAt = performance.now();
					try {
						await client.query("begin");
						await client.query(
							realmScoped
								? `insert into ${FixtureSchema}.hot_realm_fact
									(realm_id, unit_id, target_id, profile_id, value)
								 values (md5('hot-realm')::uuid, md5('hot-unit')::uuid,
									md5('hot-target')::uuid, md5($1)::uuid, 1)`
								: `insert into ${FixtureSchema}.hot_global_fact
									(unit_id, target_id, profile_id, value)
								 values (md5('hot-unit')::uuid, md5('hot-target')::uuid,
									md5($1)::uuid, 1)`,
							[`${realmScoped ? "realm" : "global"}:${concurrency}:${worker}:${sample}`],
						);
						await client.query(
							realmScoped
								? `insert into ${FixtureSchema}.hot_realm_aggregate
									(realm_id, unit_id, target_id, score, vote_count)
								 values (md5('hot-realm')::uuid, md5('hot-unit')::uuid,
									md5('hot-target')::uuid, 1, 1)
								 on conflict (realm_id, unit_id, target_id) do update set
									score = ${FixtureSchema}.hot_realm_aggregate.score + 1,
									vote_count = ${FixtureSchema}.hot_realm_aggregate.vote_count + 1`
								: `insert into ${FixtureSchema}.hot_global_aggregate
									(unit_id, target_id, score, vote_count)
								 values (md5('hot-unit')::uuid, md5('hot-target')::uuid, 1, 1)
								 on conflict (unit_id, target_id) do update set
									score = ${FixtureSchema}.hot_global_aggregate.score + 1,
									vote_count = ${FixtureSchema}.hot_global_aggregate.vote_count + 1`,
						);
						await client.query("commit");
						latencies.push(performance.now() - startedAt);
					} catch (error) {
						await client.query("rollback").catch(() => undefined);
						if (hasPostgresErrorCode(error, "57014")) timedOut += 1;
						else throw error;
					}
				}
			}),
		);
		return summarizeLatencies(latencies, timedOut);
	} finally {
		await Promise.all(clients.map((client) => client.end()));
	}
}

async function prepareWriteBenchmarks(client: Client): Promise<void> {
	await client.query(`
		create table ${FixtureSchema}.hot_global_fact (
			unit_id uuid not null, target_id uuid not null, profile_id uuid not null,
			value smallint not null, primary key (unit_id, target_id, profile_id)
		);
		create table ${FixtureSchema}.hot_global_aggregate (
			unit_id uuid not null, target_id uuid not null, score bigint not null,
			vote_count bigint not null, primary key (unit_id, target_id)
		);
		create table ${FixtureSchema}.hot_realm_fact (
			realm_id uuid not null, unit_id uuid not null, target_id uuid not null,
			profile_id uuid not null, value smallint not null,
			primary key (realm_id, unit_id, target_id, profile_id)
		);
		create table ${FixtureSchema}.hot_realm_aggregate (
			realm_id uuid not null, unit_id uuid not null, target_id uuid not null,
			score bigint not null, vote_count bigint not null,
			primary key (realm_id, unit_id, target_id)
		);
		create table ${FixtureSchema}.quick_application (
			unit_id uuid not null, structure_id uuid not null,
			created_by_profile_id uuid, pinned boolean not null default false,
			position varchar(128), created_at timestamptz not null default now(),
			updated_at timestamptz not null default now(),
			primary key (unit_id, structure_id)
		);
		create index quick_application_structure_idx
			on ${FixtureSchema}.quick_application (structure_id, unit_id);
		create index quick_application_unit_position_idx
			on ${FixtureSchema}.quick_application (unit_id, pinned, position, structure_id);

		create table ${FixtureSchema}.quick_application_judgment (
			unit_id uuid not null, structure_id uuid not null, profile_id uuid not null,
			fit_vote integer not null check (fit_vote in (-1, 1)),
			spoiler_level smallint, fit_updated_at timestamptz not null,
			spoiler_updated_at timestamptz, created_at timestamptz not null default now(),
			updated_at timestamptz not null default now(),
			primary key (unit_id, structure_id, profile_id)
		);
		create index quick_application_judgment_profile_idx
			on ${FixtureSchema}.quick_application_judgment (profile_id, unit_id, structure_id);

		create table ${FixtureSchema}.quick_application_stat (
			unit_id uuid not null, structure_id uuid not null,
			score bigint not null, vote_count bigint not null,
			spoiler_vote_count bigint not null, spoiler_none_count bigint not null,
			spoiler_minor_count bigint not null, spoiler_major_count bigint not null,
			updated_at timestamptz not null default now(),
			primary key (unit_id, structure_id)
		);
		create table ${FixtureSchema}.quick_support (
			unit_id uuid not null, tag_id uuid not null, profile_id uuid not null,
			structure_id uuid not null, created_at timestamptz not null default now(),
			primary key (unit_id, tag_id, profile_id, structure_id)
		);
		create index quick_support_effective_vote_idx
			on ${FixtureSchema}.quick_support (unit_id, tag_id, profile_id);
		create index quick_support_structure_idx
			on ${FixtureSchema}.quick_support (structure_id, unit_id, profile_id);

		create table ${FixtureSchema}.quick_effective_tag (
			unit_id uuid not null, tag_id uuid not null, direct boolean not null,
			structure_support_count bigint not null,
			created_at timestamptz not null default now(),
			updated_at timestamptz not null default now(),
			primary key (unit_id, tag_id)
		);
		create index quick_effective_tag_tag_idx
			on ${FixtureSchema}.quick_effective_tag (tag_id, unit_id);

		create table ${FixtureSchema}.quick_effective_vote (
			unit_id uuid not null, tag_id uuid not null, profile_id uuid not null,
			value integer not null check (value in (-1, 1)),
			created_at timestamptz not null default now(),
			updated_at timestamptz not null default now(),
			primary key (unit_id, tag_id, profile_id)
		);
		create index quick_effective_vote_profile_idx
			on ${FixtureSchema}.quick_effective_vote (profile_id, unit_id);

		create table ${FixtureSchema}.quick_tag_stat (
			unit_id uuid not null, tag_id uuid not null,
			score bigint not null, vote_count bigint not null,
			spoiler_vote_count bigint not null, spoiler_none_count bigint not null,
			spoiler_minor_count bigint not null, spoiler_major_count bigint not null,
			updated_at timestamptz not null default now(),
			primary key (unit_id, tag_id)
		);

		create table ${FixtureSchema}.aggregate_write_unit_tag_stat
			(like ${FixtureSchema}.unit_tag_judgment_stat including all);
		create table ${FixtureSchema}.aggregate_write_unit_structure_application_stat
			(like ${FixtureSchema}.unit_structure_application_judgment_stat including all);
		create table ${FixtureSchema}.aggregate_write_realm_tag_stat
			(like ${FixtureSchema}.realm_tag_judgment_stat including all);
		create table ${FixtureSchema}.aggregate_write_subject_association_stat
			(like ${FixtureSchema}.subject_association_judgment_stat including all);
	`);
}

function aggregateWriteTable(name: AggregateProjectionName): string {
	switch (name) {
		case "unit_tag_judgment_stat":
			return `${FixtureSchema}.aggregate_write_unit_tag_stat`;
		case "unit_structure_application_judgment_stat":
			return `${FixtureSchema}.aggregate_write_unit_structure_application_stat`;
		case "realm_tag_judgment_stat":
			return `${FixtureSchema}.aggregate_write_realm_tag_stat`;
		case "subject_association_judgment_stat":
			return `${FixtureSchema}.aggregate_write_subject_association_stat`;
	}
}

async function upsertAggregateProjection(
	client: Client,
	name: AggregateProjectionName,
	sample: number,
	updatedBranch: boolean,
): Promise<void> {
	const identity = `aggregate-maintenance:${name}:${sample}`;
	const score = updatedBranch ? -1 : 1;
	const spoilerNoneCount = updatedBranch ? 0 : 1;
	const spoilerMinorCount = updatedBranch ? 1 : 0;
	switch (name) {
		case "unit_tag_judgment_stat":
			await client.query(
				`insert into ${FixtureSchema}.aggregate_write_unit_tag_stat
					(unit_id, tag_id, score, vote_count, spoiler_vote_count,
					 spoiler_none_count, spoiler_minor_count, spoiler_major_count, updated_at)
				 values (md5($1::text || ':unit')::uuid, md5($1::text || ':tag')::uuid,
					$2, 1, 1, $3, $4, 0, now())
				 on conflict (unit_id, tag_id) do update set
					score = excluded.score, vote_count = excluded.vote_count,
					spoiler_vote_count = excluded.spoiler_vote_count,
					spoiler_none_count = excluded.spoiler_none_count,
					spoiler_minor_count = excluded.spoiler_minor_count,
					spoiler_major_count = excluded.spoiler_major_count,
					updated_at = excluded.updated_at`,
				[identity, score, spoilerNoneCount, spoilerMinorCount],
			);
			return;
		case "unit_structure_application_judgment_stat":
			await client.query(
				`insert into ${FixtureSchema}.aggregate_write_unit_structure_application_stat
					(unit_id, structure_id, score, vote_count, spoiler_vote_count,
					 spoiler_none_count, spoiler_minor_count, spoiler_major_count, updated_at)
				 values (md5($1::text || ':unit')::uuid, md5($1::text || ':structure')::uuid,
					$2, 1, 1, $3, $4, 0, now())
				 on conflict (unit_id, structure_id) do update set
					score = excluded.score, vote_count = excluded.vote_count,
					spoiler_vote_count = excluded.spoiler_vote_count,
					spoiler_none_count = excluded.spoiler_none_count,
					spoiler_minor_count = excluded.spoiler_minor_count,
					spoiler_major_count = excluded.spoiler_major_count,
					updated_at = excluded.updated_at`,
				[identity, score, spoilerNoneCount, spoilerMinorCount],
			);
			return;
		case "realm_tag_judgment_stat":
			await client.query(
				`insert into ${FixtureSchema}.aggregate_write_realm_tag_stat
					(realm_id, unit_id, tag_id, score, vote_count, spoiler_vote_count,
					 spoiler_none_count, spoiler_minor_count, spoiler_major_count, updated_at)
				 values (md5($1::text || ':realm')::uuid, md5($1::text || ':unit')::uuid,
					md5($1::text || ':tag')::uuid, $2, 1, 1, $3, $4, 0, now())
				 on conflict (realm_id, unit_id, tag_id) do update set
					score = excluded.score, vote_count = excluded.vote_count,
					spoiler_vote_count = excluded.spoiler_vote_count,
					spoiler_none_count = excluded.spoiler_none_count,
					spoiler_minor_count = excluded.spoiler_minor_count,
					spoiler_major_count = excluded.spoiler_major_count,
					updated_at = excluded.updated_at`,
				[identity, score, spoilerNoneCount, spoilerMinorCount],
			);
			return;
		case "subject_association_judgment_stat":
			await client.query(
				`insert into ${FixtureSchema}.aggregate_write_subject_association_stat
					(association_id, spoiler_vote_count, spoiler_none_count,
					 spoiler_minor_count, spoiler_major_count, updated_at)
				 values (md5($1)::uuid, 1, $2, $3, 0, now())
				 on conflict (association_id) do update set
					spoiler_vote_count = excluded.spoiler_vote_count,
					spoiler_none_count = excluded.spoiler_none_count,
					spoiler_minor_count = excluded.spoiler_minor_count,
					spoiler_major_count = excluded.spoiler_major_count,
					updated_at = excluded.updated_at`,
				[identity, spoilerNoneCount, spoilerMinorCount],
			);
			return;
	}
}

async function deleteAggregateProjection(
	client: Client,
	name: AggregateProjectionName,
	sample: number,
): Promise<void> {
	const identity = `aggregate-maintenance:${name}:${sample}`;
	switch (name) {
		case "unit_tag_judgment_stat":
			await client.query(
				`delete from ${FixtureSchema}.aggregate_write_unit_tag_stat
				 where unit_id = md5($1::text || ':unit')::uuid
					and tag_id = md5($1::text || ':tag')::uuid`,
				[identity],
			);
			return;
		case "unit_structure_application_judgment_stat":
			await client.query(
				`delete from ${FixtureSchema}.aggregate_write_unit_structure_application_stat
				 where unit_id = md5($1::text || ':unit')::uuid
					and structure_id = md5($1::text || ':structure')::uuid`,
				[identity],
			);
			return;
		case "realm_tag_judgment_stat":
			await client.query(
				`delete from ${FixtureSchema}.aggregate_write_realm_tag_stat
				 where realm_id = md5($1::text || ':realm')::uuid
					and unit_id = md5($1::text || ':unit')::uuid
					and tag_id = md5($1::text || ':tag')::uuid`,
				[identity],
			);
			return;
		case "subject_association_judgment_stat":
			await client.query(
				`delete from ${FixtureSchema}.aggregate_write_subject_association_stat
				 where association_id = md5($1)::uuid`,
				[identity],
			);
			return;
	}
}

async function measureAggregateWrites(
	client: Client,
	writes: number,
	write: (sample: number) => Promise<void>,
): Promise<AggregateWriteOperationSummary> {
	await client.query("begin");
	try {
		const walStart = await currentInsertLsn(client);
		const startedAt = performance.now();
		for (let sample = 0; sample < writes; sample += 1) await write(sample);
		const totalMilliseconds = performance.now() - startedAt;
		const walEnd = await currentInsertLsn(client);
		await client.query("commit");
		const walBytes = await walBytesBetween(client, walStart, walEnd);
		const walBytesPerWrite = walBytes / writes;
		return {
			meanMillisecondsPerWrite: Number((totalMilliseconds / writes).toFixed(3)),
			primaryWalMegabytesPerSecondAtTwentyThousandWrites: Number(
				((walBytesPerWrite * 20_000) / 1_000_000).toFixed(3),
			),
			twoReplicaNetworkMegabytesPerSecondAtTwentyThousandWrites: Number(
				((walBytesPerWrite * 20_000 * 2) / 1_000_000).toFixed(3),
			),
			walBytes,
			walBytesPerWrite: Number(walBytesPerWrite.toFixed(3)),
			writes,
		};
	} catch (error) {
		await client.query("rollback");
		throw error;
	}
}

async function assertAggregateWriteCount(
	client: Client,
	name: AggregateProjectionName,
	expected: number,
): Promise<void> {
	const actual = await queryOne(
		client,
		aggregateWriteCountRow,
		`select count(*)::text as count from ${aggregateWriteTable(name)}`,
	);
	if (actual.count !== expected)
		throw new Error(`${name} write fixture expected ${expected} rows, received ${actual.count}`);
}

async function runAggregateProjectionMaintenance(
	client: Client,
	name: AggregateProjectionName,
	writes: number,
): Promise<AggregateMaintenanceSummary> {
	const insertBranch = await measureAggregateWrites(client, writes, async (sample) => {
		await upsertAggregateProjection(client, name, sample, false);
	});
	await assertAggregateWriteCount(client, name, writes);
	const updateBranch = await measureAggregateWrites(client, writes, async (sample) => {
		await upsertAggregateProjection(client, name, sample, true);
	});
	await assertAggregateWriteCount(client, name, writes);
	const deleteSummary = await measureAggregateWrites(client, writes, async (sample) => {
		await deleteAggregateProjection(client, name, sample);
	});
	await assertAggregateWriteCount(client, name, 0);
	return { delete: deleteSummary, insertBranch, updateBranch };
}

async function runAggregateMaintenance(
	client: Client,
	writes: number,
): Promise<Readonly<Record<AggregateProjectionName, AggregateMaintenanceSummary>>> {
	return {
		unit_tag_judgment_stat: await runAggregateProjectionMaintenance(
			client,
			"unit_tag_judgment_stat",
			writes,
		),
		unit_structure_application_judgment_stat: await runAggregateProjectionMaintenance(
			client,
			"unit_structure_application_judgment_stat",
			writes,
		),
		realm_tag_judgment_stat: await runAggregateProjectionMaintenance(
			client,
			"realm_tag_judgment_stat",
			writes,
		),
		subject_association_judgment_stat: await runAggregateProjectionMaintenance(
			client,
			"subject_association_judgment_stat",
			writes,
		),
	};
}

async function readQuickAddMutationCounts(client: Client): Promise<QuickAddMutationCounts> {
	return await queryOne(
		client,
		quickAddCountsRow,
		`select
			(select count(*) from ${FixtureSchema}.quick_application)::text as "application",
			(select count(*) from ${FixtureSchema}.quick_application_judgment)::text
				as "applicationJudgment",
			(select count(*) from ${FixtureSchema}.quick_application_stat)::text
				as "applicationStat",
			(select count(*) from ${FixtureSchema}.quick_effective_tag)::text as "effectiveTag",
			(select count(*) from ${FixtureSchema}.quick_effective_vote)::text as "effectiveVote",
			(select count(*) from ${FixtureSchema}.quick_support)::text as "structureSupport",
			(select count(*) from ${FixtureSchema}.quick_tag_stat)::text as "tagStat"`,
	);
}

function subtractQuickAddCounts(
	after: QuickAddMutationCounts,
	before: QuickAddMutationCounts,
): QuickAddMutationCounts {
	return {
		application: after.application - before.application,
		applicationJudgment: after.applicationJudgment - before.applicationJudgment,
		applicationStat: after.applicationStat - before.applicationStat,
		effectiveTag: after.effectiveTag - before.effectiveTag,
		effectiveVote: after.effectiveVote - before.effectiveVote,
		structureSupport: after.structureSupport - before.structureSupport,
		tagStat: after.tagStat - before.tagStat,
	};
}

function expectedQuickAddMutations(pathLength: number, samples: number): QuickAddMutationCounts {
	return {
		application: samples,
		applicationJudgment: samples,
		applicationStat: samples,
		effectiveTag: pathLength * samples,
		effectiveVote: pathLength * samples,
		structureSupport: pathLength * samples,
		tagStat: pathLength * samples,
	};
}

function totalQuickAddMutations(counts: QuickAddMutationCounts): number {
	return (
		counts.application +
		counts.applicationJudgment +
		counts.applicationStat +
		counts.effectiveTag +
		counts.effectiveVote +
		counts.structureSupport +
		counts.tagStat
	);
}

function assertQuickAddMutations(
	actual: QuickAddMutationCounts,
	expected: QuickAddMutationCounts,
): void {
	if (
		actual.application !== expected.application ||
		actual.applicationJudgment !== expected.applicationJudgment ||
		actual.applicationStat !== expected.applicationStat ||
		actual.effectiveTag !== expected.effectiveTag ||
		actual.effectiveVote !== expected.effectiveVote ||
		actual.structureSupport !== expected.structureSupport ||
		actual.tagStat !== expected.tagStat
	)
		throw new Error(
			`Quick-add projection mutations differ: expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`,
		);
}

async function runQuickAdd(
	client: Client,
	pathLength: number,
	samples: number,
): Promise<QuickAddSummary> {
	const beforeCounts = await readQuickAddMutationCounts(client);
	const walStart = await currentLsn(client);
	const startedAt = performance.now();
	for (let sample = 0; sample < samples; sample += 1) {
		await client.query("begin");
		try {
			await client.query(
				`insert into ${FixtureSchema}.quick_application
					(unit_id, structure_id, created_by_profile_id)
				 select md5($1)::uuid, md5($2)::uuid, md5($3)::uuid
				 on conflict (unit_id, structure_id) do nothing`,
				[
					`quick-unit:${pathLength}:${sample}`,
					`quick-structure:${pathLength}:${sample}`,
					"quick-profile",
				],
			);
			await client.query(
				`insert into ${FixtureSchema}.quick_application_judgment
					(unit_id, structure_id, profile_id, fit_vote, fit_updated_at)
				 select md5($1)::uuid, md5($2)::uuid, md5($3)::uuid, 1, now()
				 on conflict (unit_id, structure_id, profile_id) do update set
					fit_vote = excluded.fit_vote, fit_updated_at = excluded.fit_updated_at,
					updated_at = now()`,
				[
					`quick-unit:${pathLength}:${sample}`,
					`quick-structure:${pathLength}:${sample}`,
					"quick-profile",
				],
			);
			await client.query(
				`insert into ${FixtureSchema}.quick_application_stat
				 select md5($1)::uuid, md5($2)::uuid, 1, 1, 0, 0, 0, 0, now()
				 on conflict (unit_id, structure_id) do update set
					score = excluded.score, vote_count = excluded.vote_count, updated_at = now()`,
				[`quick-unit:${pathLength}:${sample}`, `quick-structure:${pathLength}:${sample}`],
			);
			await client.query(
				`insert into ${FixtureSchema}.quick_support
				 select md5($1)::uuid, md5($2::text || member.ordinal::text)::uuid,
					md5($3)::uuid, md5($4)::uuid
				 from generate_series(1, $5::integer) member(ordinal)
				 on conflict do nothing`,
				[
					`quick-unit:${pathLength}:${sample}`,
					`quick-tag:${pathLength}:${sample}:`,
					"quick-profile",
					`quick-structure:${pathLength}:${sample}`,
					pathLength,
				],
			);
			await client.query(
				`insert into ${FixtureSchema}.quick_effective_tag
					(unit_id, tag_id, direct, structure_support_count)
				 select md5($1)::uuid, md5($2::text || member.ordinal::text)::uuid, false, 1
				 from generate_series(1, $3::integer) member(ordinal)
				 on conflict (unit_id, tag_id) do update set
					structure_support_count =
						${FixtureSchema}.quick_effective_tag.structure_support_count + 1,
					updated_at = now()`,
				[`quick-unit:${pathLength}:${sample}`, `quick-tag:${pathLength}:${sample}:`, pathLength],
			);
			await client.query(
				`insert into ${FixtureSchema}.quick_effective_vote
					(unit_id, tag_id, profile_id, value)
				 select md5($1)::uuid, md5($2::text || member.ordinal::text)::uuid,
					md5($3)::uuid, 1
				 from generate_series(1, $4::integer) member(ordinal)
				 on conflict (unit_id, tag_id, profile_id) do update set
					value = excluded.value, updated_at = now()`,
				[
					`quick-unit:${pathLength}:${sample}`,
					`quick-tag:${pathLength}:${sample}:`,
					"quick-profile",
					pathLength,
				],
			);
			await client.query(
				`insert into ${FixtureSchema}.quick_tag_stat
				 select md5($1)::uuid, md5($2::text || member.ordinal::text)::uuid,
					1, 1, 0, 0, 0, 0, now()
				 from generate_series(1, $3::integer) member(ordinal)
				 on conflict (unit_id, tag_id) do update set
					score = excluded.score, vote_count = excluded.vote_count, updated_at = now()`,
				[`quick-unit:${pathLength}:${sample}`, `quick-tag:${pathLength}:${sample}:`, pathLength],
			);
			await client.query("commit");
		} catch (error) {
			await client.query("rollback");
			throw error;
		}
	}
	const totalMilliseconds = Number((performance.now() - startedAt).toFixed(3));
	const walEnd = await currentLsn(client);
	const walBytes = await walBytesBetween(client, walStart, walEnd);
	const afterCounts = await readQuickAddMutationCounts(client);
	const rowMutations = subtractQuickAddCounts(afterCounts, beforeCounts);
	const expectedMutations = expectedQuickAddMutations(pathLength, samples);
	assertQuickAddMutations(rowMutations, expectedMutations);
	const rowMutationTotal = totalQuickAddMutations(rowMutations);
	const rowMutationsPerAdd = rowMutationTotal / samples;
	if (rowMutationsPerAdd !== 3 + 4 * pathLength)
		throw new Error(`Quick-add amplification must equal 3 + 4L, received ${rowMutationsPerAdd}`);
	return {
		pathLength,
		meanMillisecondsPerAdd: Number((totalMilliseconds / samples).toFixed(3)),
		rowMutations,
		rowMutationsPerAdd,
		samples,
		totalMilliseconds,
		walBytes,
		walBytesPerAdd: Math.round(walBytes / samples),
		walBytesPerRowMutation: Number((walBytes / rowMutationTotal).toFixed(3)),
	};
}

async function createRealmUnitTagRouteShape(
	client: Client,
	rowCount: number,
): Promise<ImporterEvidenceLoadSummary> {
	await client.query(
		"create table " +
			FixtureSchema +
			".realm_unit_tag_route (" +
			"realm_id uuid not null,unit_id uuid not null,tag_id uuid not null," +
			"position text not null,created_by_profile_id uuid not null," +
			"created_at timestamptz not null,updated_at timestamptz not null," +
			"primary key(realm_id,unit_id,tag_id))",
	);
	await client.query(
		"create index realm_unit_tag_tag_idx on " +
			FixtureSchema +
			".realm_unit_tag_route (realm_id,tag_id,unit_id)",
	);
	await client.query(
		"create index realm_unit_tag_tag_route_idx on " +
			FixtureSchema +
			".realm_unit_tag_route (tag_id,realm_id,unit_id)",
	);
	await client.query(
		"create index realm_unit_tag_unit_merge_idx on " +
			FixtureSchema +
			".realm_unit_tag_route (unit_id,realm_id,tag_id)",
	);
	const walStart = await currentInsertLsn(client);
	const startedAt = performance.now();
	await client.query(
		"insert into " +
			FixtureSchema +
			".realm_unit_tag_route " +
			"select md5('route-realm:'||(1+ordinal%1000))::uuid," +
			"md5('route-unit:'||ordinal)::uuid," +
			"case when ordinal<=53507 then md5('route-hot-tag')::uuid " +
			"else md5('route-tag:'||(1+ordinal%1562))::uuid end,'a0'," +
			"md5('profile:'||(1+ordinal%4414))::uuid,now(),now() " +
			"from generate_series(1,$1::integer) ordinal",
		[rowCount],
	);
	const loadMilliseconds = performance.now() - startedAt;
	const walEnd = await currentInsertLsn(client);
	const walBytes = await walBytesBetween(client, walStart, walEnd);
	await client.query("analyze " + FixtureSchema + ".realm_unit_tag_route");
	return {
		loadMilliseconds: Math.round(loadMilliseconds),
		walBytes,
		walBytesPerRow: Number((walBytes / rowCount).toFixed(3)),
	};
}

async function createImporterEvidenceShapes(
	client: Client,
	rowCount: number,
): Promise<Readonly<Record<ImporterEvidenceShapeName, ImporterEvidenceLoadSummary>>> {
	const ddl = [
		"create table " +
			FixtureSchema +
			".content_pack_import (" +
			"id uuid primary key,pack_id text not null,version text not null,checksum text not null," +
			"source_lock_kind text not null,manifest_snapshot jsonb not null," +
			"source_lock_snapshot jsonb not null,rights_snapshot jsonb not null," +
			"bindings_snapshot jsonb not null,importer_profile_id uuid not null," +
			"applied_at timestamptz(3) not null," +
			"unique(pack_id,version),unique(id,importer_profile_id))",
		"create index content_pack_import_profile_applied_idx on " +
			FixtureSchema +
			".content_pack_import (importer_profile_id,applied_at desc,id)",
		"create table " +
			FixtureSchema +
			".content_pack_tag_evidence (" +
			"import_id uuid not null,source_fingerprint text not null,tag_id uuid not null," +
			"tag_source_key text not null,directly_applicable boolean not null," +
			"default_spoiler_level smallint,source_category text,parent_source_keys text[] not null," +
			"primary_parent_source_key text,source_url text not null," +
			"source_imported_at timestamptz(3) not null,created_at timestamptz not null," +
			"primary key(import_id,source_fingerprint))",
		"create index content_pack_tag_evidence_tag_idx on " +
			FixtureSchema +
			".content_pack_tag_evidence (tag_id,import_id)",
		"create table " +
			FixtureSchema +
			".content_pack_unit_tag_evidence (" +
			"import_id uuid not null,source_fingerprint text not null,unit_id uuid not null," +
			"tag_id uuid not null,profile_id uuid not null,unit_source_key text not null," +
			"tag_source_key text not null,source_fit_vote integer not null," +
			"source_spoiler_level smallint,source_url text not null," +
			"source_imported_at timestamptz(3) not null,source_aggregate jsonb," +
			"created_at timestamptz not null,primary key(import_id,source_fingerprint))",
		"create index content_pack_unit_tag_evidence_judgment_idx on " +
			FixtureSchema +
			".content_pack_unit_tag_evidence (unit_id,tag_id,profile_id,import_id)",
		"create table " +
			FixtureSchema +
			".content_pack_structure_definition_evidence (" +
			"import_id uuid not null,source_fingerprint text not null,structure_id uuid not null," +
			"profile_id uuid not null,declared_structure_id uuid not null," +
			"path_source_key text not null,primary_source_path boolean not null," +
			"source_vote integer not null,source_url text not null," +
			"source_imported_at timestamptz(3) not null,created_at timestamptz not null," +
			"primary key(import_id,source_fingerprint))",
		"create index content_pack_structure_definition_evidence_vote_idx on " +
			FixtureSchema +
			".content_pack_structure_definition_evidence (structure_id,profile_id,import_id)",
		"create table " +
			FixtureSchema +
			".content_pack_structure_application_evidence (" +
			"import_id uuid not null,source_fingerprint text not null,unit_id uuid not null," +
			"structure_id uuid not null,profile_id uuid not null,unit_source_key text not null," +
			"path_source_key text not null,declared_structure_id uuid not null," +
			"source_fit_vote integer not null,source_spoiler_level smallint,source_url text not null," +
			"source_imported_at timestamptz(3) not null,source_aggregate jsonb," +
			"created_at timestamptz not null,primary key(import_id,source_fingerprint))",
		"create index content_pack_structure_application_evidence_judgment_idx on " +
			FixtureSchema +
			".content_pack_structure_application_evidence " +
			"(unit_id,structure_id,profile_id,import_id)",
		"create table " +
			FixtureSchema +
			".content_pack_subject_association_evidence (" +
			"import_id uuid not null,source_fingerprint text not null,association_id uuid not null," +
			"profile_id uuid not null,declared_association_id uuid not null," +
			"subject_source_key text not null,source_spoiler_level smallint not null," +
			"source_url text not null,source_imported_at timestamptz(3) not null," +
			"created_at timestamptz not null,primary key(import_id,source_fingerprint))",
		"create index content_pack_subject_association_evidence_judgment_idx on " +
			FixtureSchema +
			".content_pack_subject_association_evidence " +
			"(association_id,profile_id,import_id)",
	];
	for (const statement of ddl) await client.query(statement);
	const inserts: Readonly<Record<ImporterEvidenceShapeName, string>> = {
		content_pack_import:
			"insert into " +
			FixtureSchema +
			".content_pack_import " +
			"select md5('import:'||ordinal)::uuid,'pack-'||ordinal,'1'," +
			"md5('checksum-a:'||ordinal)||md5('checksum-b:'||ordinal),'snapshot'," +
			"jsonb_build_object('id','pack-'||ordinal,'version','1')," +
			"jsonb_build_object('kind','snapshot','source','vndb')," +
			"jsonb_build_array(jsonb_build_object('license','CC-BY-SA-4.0'))," +
			"jsonb_build_array(jsonb_build_object('kind','vndb-tag'))," +
			"md5('profile:'||(1+ordinal%4414))::uuid,now() " +
			"from generate_series(1,$1::integer) ordinal",
		content_pack_tag_evidence:
			"insert into " +
			FixtureSchema +
			".content_pack_tag_evidence " +
			"select md5('import:'||ordinal)::uuid," +
			"md5('tag-fingerprint-a:'||ordinal)||md5('tag-fingerprint-b:'||ordinal)," +
			"md5('tag:'||ordinal)::uuid,'g'||ordinal,true,ordinal%3,'content'," +
			"case when ordinal%4=0 then array['g'||(ordinal-1)] else array[]::text[] end," +
			"case when ordinal%4=0 then 'g'||(ordinal-1) end," +
			"'https://vndb.org/g'||ordinal,now(),now() " +
			"from generate_series(1,$1::integer) ordinal",
		content_pack_unit_tag_evidence:
			"insert into " +
			FixtureSchema +
			".content_pack_unit_tag_evidence " +
			"select md5('import:'||ordinal)::uuid," +
			"md5('unit-tag-fingerprint-a:'||ordinal)||md5('unit-tag-fingerprint-b:'||ordinal)," +
			"md5('unit:'||ordinal)::uuid,md5('tag:'||(1+ordinal%1562))::uuid," +
			"md5('profile:'||(1+ordinal%4414))::uuid,'v'||ordinal,'g'||(1+ordinal%1562)," +
			"case when ordinal%20=0 then -1 else 1 end," +
			"case when ordinal%5=0 then ordinal%3 end,'https://vndb.org/v'||ordinal,now()," +
			"case when ordinal%7=0 then jsonb_build_object('rating',ordinal%100,'votes',1+ordinal%500) end," +
			"now() from generate_series(1,$1::integer) ordinal",
		content_pack_structure_definition_evidence:
			"insert into " +
			FixtureSchema +
			".content_pack_structure_definition_evidence " +
			"select md5('import:'||ordinal)::uuid," +
			"md5('definition-fingerprint-a:'||ordinal)||md5('definition-fingerprint-b:'||ordinal)," +
			"md5('structure:'||ordinal)::uuid,md5('profile:'||(1+ordinal%4414))::uuid," +
			"md5('declared-structure:'||ordinal)::uuid,'path-'||ordinal,ordinal%8=0,1," +
			"'https://vndb.org/g'||ordinal,now(),now() " +
			"from generate_series(1,$1::integer) ordinal",
		content_pack_structure_application_evidence:
			"insert into " +
			FixtureSchema +
			".content_pack_structure_application_evidence " +
			"select md5('import:'||ordinal)::uuid," +
			"md5('application-fingerprint-a:'||ordinal)||md5('application-fingerprint-b:'||ordinal)," +
			"md5('unit:'||ordinal)::uuid,md5('structure:'||(1+ordinal%100000))::uuid," +
			"md5('profile:'||(1+ordinal%4414))::uuid,'v'||ordinal," +
			"'path-'||(1+ordinal%100000),md5('declared-structure:'||(1+ordinal%100000))::uuid," +
			"case when ordinal%20=0 then -1 else 1 end," +
			"case when ordinal%5=0 then ordinal%3 end,'https://vndb.org/v'||ordinal,now()," +
			"case when ordinal%7=0 then jsonb_build_object('rating',ordinal%100,'votes',1+ordinal%500) end," +
			"now() from generate_series(1,$1::integer) ordinal",
		content_pack_subject_association_evidence:
			"insert into " +
			FixtureSchema +
			".content_pack_subject_association_evidence " +
			"select md5('import:'||ordinal)::uuid," +
			"md5('subject-fingerprint-a:'||ordinal)||md5('subject-fingerprint-b:'||ordinal)," +
			"md5('association:'||ordinal)::uuid,md5('profile:'||(1+ordinal%4414))::uuid," +
			"md5('declared-association:'||ordinal)::uuid,'subject-'||ordinal,ordinal%3," +
			"'https://vndb.org/c'||ordinal,now(),now() " +
			"from generate_series(1,$1::integer) ordinal",
	};
	const measure = async (name: ImporterEvidenceShapeName): Promise<ImporterEvidenceLoadSummary> => {
		const walStart = await currentInsertLsn(client);
		const startedAt = performance.now();
		await client.query(inserts[name], [rowCount]);
		const loadMilliseconds = performance.now() - startedAt;
		const walEnd = await currentInsertLsn(client);
		const walBytes = await walBytesBetween(client, walStart, walEnd);
		await client.query("analyze " + FixtureSchema + "." + name);
		return {
			loadMilliseconds: Math.round(loadMilliseconds),
			walBytes,
			walBytesPerRow: Number((walBytes / rowCount).toFixed(3)),
		};
	};
	return {
		content_pack_import: await measure("content_pack_import"),
		content_pack_structure_application_evidence: await measure(
			"content_pack_structure_application_evidence",
		),
		content_pack_structure_definition_evidence: await measure(
			"content_pack_structure_definition_evidence",
		),
		content_pack_subject_association_evidence: await measure(
			"content_pack_subject_association_evidence",
		),
		content_pack_tag_evidence: await measure("content_pack_tag_evidence"),
		content_pack_unit_tag_evidence: await measure("content_pack_unit_tag_evidence"),
	};
}

function importerEvidenceCapacity(
	byName: ReadonlyMap<string, z.infer<typeof relationSizeRow>>,
	loads: Readonly<Record<ImporterEvidenceShapeName, ImporterEvidenceLoadSummary>>,
): Readonly<Record<ImporterEvidenceShapeName, ImporterEvidenceCapacitySummary>> {
	return {
		content_pack_import: {
			capacity: aggregateCapacityProjection(requireRelationSize(byName, "content_pack_import")),
			load: loads.content_pack_import,
		},
		content_pack_structure_application_evidence: {
			capacity: aggregateCapacityProjection(
				requireRelationSize(byName, "content_pack_structure_application_evidence"),
			),
			load: loads.content_pack_structure_application_evidence,
		},
		content_pack_structure_definition_evidence: {
			capacity: aggregateCapacityProjection(
				requireRelationSize(byName, "content_pack_structure_definition_evidence"),
			),
			load: loads.content_pack_structure_definition_evidence,
		},
		content_pack_subject_association_evidence: {
			capacity: aggregateCapacityProjection(
				requireRelationSize(byName, "content_pack_subject_association_evidence"),
			),
			load: loads.content_pack_subject_association_evidence,
		},
		content_pack_tag_evidence: {
			capacity: aggregateCapacityProjection(
				requireRelationSize(byName, "content_pack_tag_evidence"),
			),
			load: loads.content_pack_tag_evidence,
		},
		content_pack_unit_tag_evidence: {
			capacity: aggregateCapacityProjection(
				requireRelationSize(byName, "content_pack_unit_tag_evidence"),
			),
			load: loads.content_pack_unit_tag_evidence,
		},
	};
}

function postgresErrorField(error: unknown, field: "code" | "constraint"): string | undefined {
	if (typeof error !== "object" || error === null || !(field in error)) return undefined;
	const value = (error as Record<string, unknown>)[field];
	return typeof value === "string" ? value : undefined;
}

export function realHotKeyAttemptAccountingIsExact(counts: {
	readonly attemptedTransactions: number;
	readonly backpressuredAttempts: number;
	readonly deadlocks: number;
	readonly otherErrors: number;
	readonly succeededRequests: number;
	readonly timedOutAttempts: number;
}): boolean {
	return (
		counts.attemptedTransactions ===
		counts.succeededRequests +
			counts.backpressuredAttempts +
			counts.deadlocks +
			counts.timedOutAttempts +
			counts.otherErrors
	);
}

export function realHotKeyTerminalAccountingIsExact(counts: {
	readonly logicalRequests: number;
	readonly succeededRequests: number;
	readonly terminalBackpressuredRequests: number;
	readonly terminalDeadlockRequests: number;
	readonly terminalOtherErrorRequests: number;
	readonly terminalTimedOutRequests: number;
}): boolean {
	return (
		counts.logicalRequests ===
		counts.succeededRequests +
			counts.terminalBackpressuredRequests +
			counts.terminalDeadlockRequests +
			counts.terminalTimedOutRequests +
			counts.terminalOtherErrorRequests
	);
}

function realFixtureUuid(sequence: number): string {
	return "7c000000-0000-7000-8000-" + sequence.toString(16).padStart(12, "0");
}

type RealHotKeySeed = Readonly<{
	authUserIds: readonly string[];
	fixtures: readonly RealHotKeyFixture[];
	unitIds: readonly string[];
}>;

function buildRealHotKeySeed(): RealHotKeySeed {
	let sequence = 1;
	const nextId = (): string => realFixtureUuid(sequence++);
	const authUserIds = Array.from({ length: RealHotKeyConcurrency }, nextId);
	const profileIds = Array.from({ length: RealHotKeyConcurrency }, nextId);
	const unitIds = [...profileIds];
	const fixtures: RealHotKeyFixture[] = [];
	for (const authority of ["global", "realm"] as const) {
		for (const pathLength of [2, 4, 16]) {
			const unitId = nextId();
			const tagIds = Array.from({ length: pathLength }, nextId).sort();
			unitIds.push(unitId, ...tagIds);
			if (authority === "global") {
				const structureId = nextId();
				unitIds.push(structureId);
				fixtures.push({
					authority,
					pathLength,
					profileIds,
					structureId,
					tagIds,
					unitId,
				});
			} else {
				const realmId = nextId();
				const contextPostIds = Array.from({ length: pathLength }, nextId);
				unitIds.push(realmId, ...contextPostIds);
				fixtures.push({
					authority,
					contextPostIds,
					pathLength,
					profileIds,
					realmId,
					tagIds,
					unitId,
				});
			}
		}
	}
	return { authUserIds, fixtures, unitIds };
}

async function cleanupRealHotKeySeed(client: Client, seed: RealHotKeySeed): Promise<void> {
	await client.query("delete from public.unit where id = any($1::uuid[])", [seed.unitIds]);
	await client.query("delete from public.users where id = any($1::uuid[])", [seed.authUserIds]);
}

async function assertRealHotKeySeedAbsent(client: Client, seed: RealHotKeySeed): Promise<void> {
	const units = await queryOne(
		client,
		aggregateWriteCountRow,
		"select count(*)::text as count from public.unit where id = any($1::uuid[])",
		[seed.unitIds],
	);
	const users = await queryOne(
		client,
		aggregateWriteCountRow,
		"select count(*)::text as count from public.users where id = any($1::uuid[])",
		[seed.authUserIds],
	);
	if (units.count !== 0 || users.count !== 0)
		throw new Error("Real hot-key fixture cleanup did not remove every exact fixture identity");
}

async function seedRealHotKeyFixtures(client: Client, seed: RealHotKeySeed): Promise<void> {
	await cleanupRealHotKeySeed(client, seed);
	await assertRealHotKeySeedAbsent(client, seed);
	const profileIds = seed.fixtures[0]?.profileIds;
	if (!profileIds || profileIds.length !== RealHotKeyConcurrency)
		throw new Error("Real hot-key fixture must contain exactly 64 Profiles");
	await client.query(
		"insert into public.users " +
			"(id,name,email,email_verified,registration_content_language,created_at,updated_at) " +
			"select id,'VNDB capacity profile ' || ordinal," +
			"'vndb-capacity-' || ordinal || '@example.invalid',true,'en',now(),now() " +
			"from unnest($1::uuid[]) with ordinality as seeded(id,ordinal)",
		[seed.authUserIds],
	);
	const nonProfileUnits: { id: string; kind: string }[] = [];
	for (const fixture of seed.fixtures) {
		nonProfileUnits.push({ id: fixture.unitId, kind: "book" });
		for (const tagId of fixture.tagIds) nonProfileUnits.push({ id: tagId, kind: "tag" });
		if (fixture.authority === "global") {
			if (!fixture.structureId) throw new Error("Global fixture is missing its Structure");
			nonProfileUnits.push({ id: fixture.structureId, kind: "structure" });
		} else {
			if (!fixture.realmId) throw new Error("Realm fixture is missing its Realm");
			nonProfileUnits.push({ id: fixture.realmId, kind: "realm" });
			for (const id of fixture.contextPostIds ?? []) nonProfileUnits.push({ id, kind: "post" });
		}
	}
	const unitIds = [...profileIds, ...nonProfileUnits.map(({ id }) => id)];
	const kinds = [...profileIds.map(() => "profile"), ...nonProfileUnits.map(({ kind }) => kind)];
	await client.query(
		"insert into public.unit " +
			"(id,kind,status,visibility,moderation_status,published_at,created_at,updated_at) " +
			"select id,kind,'published','public','approved',now(),now(),now() " +
			"from unnest($1::uuid[],$2::text[]) as seeded(id,kind)",
		[unitIds, kinds],
	);
	await client.query(
		"insert into public.profile (id,auth_user_id,joined_at,created_at,updated_at) " +
			"select profile_id,auth_user_id,now(),now(),now() " +
			"from unnest($1::uuid[],$2::uuid[]) as seeded(profile_id,auth_user_id)",
		[profileIds, seed.authUserIds],
	);
	const postIds = nonProfileUnits.filter(({ kind }) => kind === "post").map(({ id }) => id);
	await client.query(
		"insert into public.post (id,kind) select id,'wiki' from unnest($1::uuid[]) as seeded(id)",
		[postIds],
	);
	const realmIds = seed.fixtures
		.filter((fixture) => fixture.authority === "realm")
		.map((fixture) => fixture.realmId);
	await client.query(
		"insert into public.realm (id,realm_tag_voting_enabled) " +
			"select id,true from unnest($1::uuid[]) as seeded(id)",
		[realmIds],
	);
	const tagIds = seed.fixtures.flatMap((fixture) => fixture.tagIds);
	await client.query(
		"insert into public.tag (id,directly_applicable) " +
			"select id,true from unnest($1::uuid[]) as seeded(id)",
		[tagIds],
	);
	for (const fixture of seed.fixtures) {
		if (fixture.authority === "global") {
			await client.query(
				"insert into public.unit_structure " +
					"(id,kind,definition_version,member_unit_ids,created_by_profile_id,created_at,updated_at) " +
					"values ($1,'tag.hierarchy_path',1,$2::uuid[],$3,now(),now())",
				[fixture.structureId, fixture.tagIds, profileIds[0]],
			);
			await client.query(
				"insert into public.unit_structure_application " +
					"(unit_id,structure_id,created_by_profile_id,pinned,position,created_at,updated_at) " +
					"values ($1,$2,$3,false,null,now(),now())",
				[fixture.unitId, fixture.structureId, profileIds[0]],
			);
			await client.query(
				"insert into public.unit_structure_application_judgment " +
					"(unit_id,structure_id,profile_id,fit_vote,fit_updated_at,created_at,updated_at) " +
					"select $1,$2,profile_id,-1,now(),now(),now() " +
					"from unnest($3::uuid[]) as seeded(profile_id)",
				[fixture.unitId, fixture.structureId, profileIds],
			);
		} else {
			const realmId = fixture.realmId;
			if (!realmId) throw new Error("Realm fixture is missing its Realm");
			const posts = fixture.contextPostIds;
			if (!posts || posts.length !== fixture.tagIds.length)
				throw new Error("Realm fixture context posts are incomplete");
			await client.query(
				"insert into public.realm_unit (realm_id,unit_id) " +
					"select $1,unit_id from unnest($2::uuid[]) as seeded(unit_id)",
				[realmId, [fixture.unitId, ...posts]],
			);
			await client.query(
				"insert into public.realm_tag_context " +
					"(realm_id,tag_id,context_post_id,created_by_profile_id) " +
					"select $1,tag_id,context_post_id,$4 " +
					"from unnest($2::uuid[],$3::uuid[]) as seeded(tag_id,context_post_id)",
				[realmId, fixture.tagIds, posts, profileIds[0]],
			);
			await client.query(
				"insert into public.realm_tag_judgment " +
					"(realm_id,unit_id,tag_id,profile_id,fit_vote,fit_updated_at,created_at,updated_at) " +
					"select $1,$2,tag_id,profile_id,-1,now(),now(),now() " +
					"from unnest($3::uuid[]) as seeded(tag_id) " +
					"cross join unnest($4::uuid[]) as profiles(profile_id) order by tag_id,profile_id",
				[realmId, fixture.unitId, fixture.tagIds, profileIds],
			);
		}
	}
}

async function mutateRealHotKey(
	client: PoolClient,
	fixture: RealHotKeyFixture,
	profileId: string,
	value: -1 | 1,
): Promise<void> {
	if (fixture.authority === "global") {
		await client.query(
			"insert into public.unit_structure_application_judgment " +
				"(unit_id,structure_id,profile_id,fit_vote,fit_updated_at,created_at,updated_at) " +
				"values ($1,$2,$3,$4,now(),now(),now()) " +
				"on conflict (unit_id,structure_id,profile_id) do update set " +
				"fit_vote=excluded.fit_vote,fit_updated_at=excluded.fit_updated_at," +
				"updated_at=excluded.updated_at",
			[fixture.unitId, fixture.structureId, profileId, value],
		);
		return;
	}
	await client.query(
		"insert into public.realm_tag_judgment " +
			"(realm_id,unit_id,tag_id,profile_id,fit_vote,fit_updated_at,created_at,updated_at) " +
			"select $1,$2,tag_id,$4,$5,now(),now(),now() " +
			"from unnest($3::uuid[]) as seeded(tag_id) order by tag_id " +
			"on conflict (realm_id,unit_id,tag_id,profile_id) do update set " +
			"fit_vote=excluded.fit_vote,fit_updated_at=excluded.fit_updated_at," +
			"updated_at=excluded.updated_at",
		[fixture.realmId, fixture.unitId, fixture.tagIds, profileId, value],
	);
}

async function runRealHotKeyAttempt(
	pool: Pool,
	fixture: RealHotKeyFixture,
	profileId: string,
	value: -1 | 1,
	onPoolSample: (connectionsInUse: number, waiting: number) => void,
	lockWaitMonitor: LockWaitMonitor,
): Promise<RealHotKeyAttemptOutcome> {
	const startedAt = performance.now();
	let connection: PoolClient | undefined;
	let destroyConnection = false;
	let backendPid: number | undefined;
	let lockWaitBaseline = 0;
	const finish = (
		outcome: Omit<RealHotKeyAttemptOutcome, "lockWaitMilliseconds">,
	): RealHotKeyAttemptOutcome => ({
		...outcome,
		lockWaitMilliseconds:
			backendPid === undefined
				? 0
				: Math.max(
						0,
						lockWaitMonitor.readCumulativeMilliseconds(backendPid) - lockWaitBaseline,
					),
	});
	try {
		connection = await pool.connect();
		backendPid = connection.processID;
		lockWaitBaseline = lockWaitMonitor.readCumulativeMilliseconds(backendPid);
		onPoolSample(pool.totalCount - pool.idleCount, pool.waitingCount);
		await connection.query("begin");
		await connection.query("set local rezics.vndb_v11_binary_contract = 'vndb-v11-contract-v1'");
		await connection.query(
			"set local lock_timeout = '" + RealHotKeyLockTimeoutMilliseconds + "ms'",
		);
		await connection.query(
			"set local statement_timeout = '" + RealHotKeyMutationTimeoutMilliseconds + "ms'",
		);
		await mutateRealHotKey(connection, fixture, profileId, value);
		await connection.query("commit");
		return finish({
			latencyMilliseconds: performance.now() - startedAt,
			outcome: "succeeded",
		});
	} catch (error) {
		if (connection)
			try {
				await connection.query("rollback");
			} catch (rollbackError) {
				destroyConnection = true;
				return finish({
					code: postgresErrorField(rollbackError, "code") ?? "ROLLBACK_FAILED",
					constraint: postgresErrorField(rollbackError, "constraint"),
					latencyMilliseconds: performance.now() - startedAt,
					outcome: "other",
				});
			}
		const code = postgresErrorField(error, "code");
		const constraint = postgresErrorField(error, "constraint");
		const latencyMilliseconds = performance.now() - startedAt;
		if (code === "55P03" && constraint === RealHotKeyBusyConstraint)
			return finish({
				busyDecisionMilliseconds: latencyMilliseconds,
				code,
				constraint,
				latencyMilliseconds,
				outcome: "backpressured",
			});
		if (code === "40P01")
			return finish({ code, constraint, latencyMilliseconds, outcome: "deadlock" });
		if (code === "57014" || code === "55P03")
			return finish({ code, constraint, latencyMilliseconds, outcome: "timedOut" });
		return finish({ code, constraint, latencyMilliseconds, outcome: "other" });
	} finally {
		connection?.release(destroyConnection);
		onPoolSample(pool.totalCount - pool.idleCount, pool.waitingCount);
	}
}

function startLockWaitMonitor(client: Client, applicationName: string): LockWaitMonitor {
	let stopping = false;
	let failed = false;
	const active = new Map<number, number>();
	const cumulativeByPid = new Map<number, number>();
	const episodes: number[] = [];
	const closeEpisode = (pid: number, startedAt: number, endedAt: number): void => {
		const elapsed = Math.max(0, endedAt - startedAt);
		episodes.push(elapsed);
		cumulativeByPid.set(pid, (cumulativeByPid.get(pid) ?? 0) + elapsed);
		active.delete(pid);
	};
	const monitoring = (async (): Promise<void> => {
		try {
			while (!stopping) {
				const result = await client.query(
					'select pid,wait_event_type as "waitEventType",wait_event as "waitEvent" ' +
						"from pg_stat_activity where application_name=$1 and pid<>pg_backend_pid()",
					[applicationName],
				);
				const rows = z.array(activityWaitRow).parse(result.rows);
				const now = performance.now();
				const locked = new Set(
					rows.filter((row) => row.waitEventType === "Lock").map((row) => row.pid),
				);
				for (const pid of locked) if (!active.has(pid)) active.set(pid, now);
				for (const [pid, startedAt] of active)
					if (!locked.has(pid)) closeEpisode(pid, startedAt, now);
				await delay(5);
			}
		} catch {
			failed = true;
		} finally {
			const now = performance.now();
			for (const [pid, startedAt] of [...active]) closeEpisode(pid, startedAt, now);
		}
	})();
	return {
		readCumulativeMilliseconds: (pid) => {
			const completed = cumulativeByPid.get(pid) ?? 0;
			const activeSince = active.get(pid);
			return activeSince === undefined
				? completed
				: completed + Math.max(0, performance.now() - activeSince);
		},
		stop: async () => {
			stopping = true;
			await monitoring;
			return { episodes, failed };
		},
	};
}

async function readDatabaseCounters(client: Client): Promise<z.infer<typeof databaseCounterRow>> {
	return queryOne(
		client,
		databaseCounterRow,
		"select deadlocks::text as deadlocks," +
			"current_setting('max_connections') as \"maxConnections\"," +
			"current_setting('superuser_reserved_connections') as \"superuserReservedConnections\"," +
			"coalesce(current_setting('reserved_connections',true),'0') as \"reservedConnections\"," +
			"(select count(*)::text from pg_stat_activity where backend_type='client backend') " +
			"as \"activeClientConnections\" " +
			"from pg_stat_database where datname=current_database()",
	);
}

async function verifyRealHotKeyParity(
	client: Client,
	fixture: RealHotKeyFixture,
	expectedValues: ReadonlyMap<string, -1 | 1>,
): Promise<Readonly<{ detail: string; passed: boolean }>> {
	const expectedProfiles = [...expectedValues.keys()].sort();
	const expectedVoteValues = expectedProfiles.map(
		(profileId) => expectedValues.get(profileId) ?? -1,
	);
	const expectedScore = expectedVoteValues.reduce((sum, value) => sum + value, 0);
	if (fixture.authority === "global") {
		const factsResult = await client.query(
			'select profile_id::text as "profileId",fit_vote as "fitVote" ' +
				"from public.unit_structure_application_judgment " +
				"where unit_id=$1 and structure_id=$2 order by profile_id",
			[fixture.unitId, fixture.structureId],
		);
		const facts = z.array(globalFactProfileRow).parse(factsResult.rows);
		const expectedFacts = expectedProfiles.map((profileId, index) => ({
			fitVote: expectedVoteValues[index],
			profileId,
		}));
		const aggregate = await queryOne(
			client,
			aggregateParityRow,
			'select score::text as score,vote_count::text as "voteCount",' +
				'spoiler_vote_count::text as "spoilerCount",' +
				'spoiler_none_count::text as "noneCount",' +
				'spoiler_minor_count::text as "minorCount",' +
				'spoiler_major_count::text as "majorCount" ' +
				"from public.unit_structure_application_judgment_stat " +
				"where unit_id=$1 and structure_id=$2",
			[fixture.unitId, fixture.structureId],
		);
		const projections = await queryOne(
			client,
			globalProjectionParityRow,
			"with target_structure as (" +
				"select active_projection_version from public.unit_structure where id=$2" +
				"), members as (" +
				"select member.member_unit_id as tag_id from public.unit_structure structure " +
				"join public.unit_structure_member member on member.structure_id=structure.id " +
				"and member.projection_version=structure.active_projection_version where structure.id=$2" +
				") select " +
				'(select count(*) from public.unit_tag_structure_support where unit_id=$1)::text as "structureSupports",' +
				"(select count(*) from public.unit_tag_structure_support support where support.unit_id=$1 and (" +
				"support.structure_id<>$2 or support.tag_id not in (select tag_id from members) or " +
				"not (support.profile_id=any($3::uuid[])) or support.projection_version is distinct from " +
				'(select active_projection_version from target_structure)))::text as "structureSupportViolations",' +
				'(select count(*) from public.unit_effective_tag_vote where unit_id=$1)::text as "effectiveVotes",' +
				"(select count(*) from public.unit_effective_tag_vote vote where vote.unit_id=$1 and (" +
				"vote.tag_id not in (select tag_id from members) or not (vote.profile_id=any($3::uuid[])) or " +
				'vote.value<>1))::text as "effectiveVoteViolations",' +
				'(select count(*) from public.unit_effective_tag where unit_id=$1)::text as "effectiveTags",' +
				"(select count(*) from public.unit_effective_tag tag where tag.unit_id=$1 and (" +
				"tag.tag_id not in (select tag_id from members) or tag.direct or " +
				'tag.structure_support_count<>cardinality($3::uuid[])))::text as "effectiveTagViolations",' +
				'(select count(*) from public.unit_tag_judgment_stat where unit_id=$1)::text as "statRows",' +
				"(select count(*) from public.unit_tag_judgment_stat stat where stat.unit_id=$1 and (" +
				"stat.tag_id not in (select tag_id from members) or " +
				"stat.score<>cardinality($3::uuid[]) or stat.vote_count<>cardinality($3::uuid[]) or " +
				"stat.spoiler_vote_count<>0 or stat.spoiler_none_count<>0 or " +
				'stat.spoiler_minor_count<>0 or stat.spoiler_major_count<>0))::text as "statViolations"',
			[
				fixture.unitId,
				fixture.structureId,
				expectedProfiles.filter((_, index) => expectedVoteValues[index] === 1),
			],
		);
		const positiveProfiles = expectedVoteValues.filter((value) => value === 1).length;
		const expectedDerived = positiveProfiles * fixture.pathLength;
		const exactFacts = JSON.stringify(facts) === JSON.stringify(expectedFacts);
		const exactAggregate =
			aggregate.score === expectedScore &&
			aggregate.voteCount === expectedProfiles.length &&
			aggregate.spoilerCount === 0 &&
			aggregate.noneCount === 0 &&
			aggregate.minorCount === 0 &&
			aggregate.majorCount === 0;
		const exactProjections =
			projections.structureSupports === expectedDerived &&
			projections.structureSupportViolations === 0 &&
			projections.effectiveVotes === expectedDerived &&
			projections.effectiveVoteViolations === 0 &&
			projections.effectiveTags === (positiveProfiles > 0 ? fixture.pathLength : 0) &&
			projections.effectiveTagViolations === 0 &&
			projections.statRows === (positiveProfiles > 0 ? fixture.pathLength : 0) &&
			projections.statViolations === 0;
		return {
			detail:
				"facts=" + exactFacts + ",aggregate=" + exactAggregate + ",projections=" + exactProjections,
			passed: exactFacts && exactAggregate && exactProjections,
		};
	}
	const factsResult = await client.query(
		'select tag_id::text as "tagId",profile_id::text as "profileId",' +
			'fit_vote as "fitVote",' +
			'count(*) over (partition by profile_id)::text as "rowCount" ' +
			"from public.realm_tag_judgment where realm_id=$1 and unit_id=$2 " +
			"order by tag_id,profile_id",
		[fixture.realmId, fixture.unitId],
	);
	const facts = z.array(realmFactProfileRow).parse(factsResult.rows);
	const expectedRealmFacts = [...fixture.tagIds]
		.sort()
		.flatMap((tagId) =>
			expectedProfiles.map((profileId, index) => ({
				fitVote: expectedVoteValues[index],
				profileId,
				rowCount: fixture.pathLength,
				tagId,
			})),
		);
	const exactFacts = JSON.stringify(facts) === JSON.stringify(expectedRealmFacts);
	let exactAggregates = true;
	for (const tagId of fixture.tagIds) {
		const aggregate = await queryOne(
			client,
			aggregateParityRow,
			'select score::text as score,vote_count::text as "voteCount",' +
				'spoiler_vote_count::text as "spoilerCount",' +
				'spoiler_none_count::text as "noneCount",' +
				'spoiler_minor_count::text as "minorCount",' +
				'spoiler_major_count::text as "majorCount" ' +
				"from public.realm_tag_judgment_stat where realm_id=$1 and unit_id=$2 and tag_id=$3",
			[fixture.realmId, fixture.unitId, tagId],
		);
		exactAggregates =
			exactAggregates &&
			aggregate.score === expectedScore &&
			aggregate.voteCount === expectedProfiles.length &&
			aggregate.spoilerCount === 0 &&
			aggregate.noneCount === 0 &&
			aggregate.minorCount === 0 &&
			aggregate.majorCount === 0;
	}
	const leaked = await queryOne(
		client,
		aggregateWriteCountRow,
		"select ((select count(*) from public.unit_effective_tag_vote where unit_id=$1 and tag_id=any($2::uuid[]))+" +
			"(select count(*) from public.unit_tag_judgment_stat where unit_id=$1 and tag_id=any($2::uuid[])))::text as count",
		[fixture.unitId, fixture.tagIds],
	);
	return {
		detail:
			"atomicFacts=" +
			exactFacts +
			",aggregates=" +
			exactAggregates +
			",globalLeakRows=" +
			leaked.count,
		passed: exactFacts && exactAggregates && leaked.count === 0,
	};
}

async function runRealHotKeyScenario(
	admin: Client,
	connectionString: string,
	fixture: RealHotKeyFixture,
	logicalRequests: number,
): Promise<RealHotKeyScenarioSummary> {
	const applicationName = "vndb-v11-capacity-" + fixture.authority + "-l" + fixture.pathLength;
	const countersBefore = await readDatabaseCounters(admin);
	const walStart = await currentInsertLsn(admin);
	const unexpectedErrorExamples = new Set<string>();
	let poolErrors = 0;
	const pool = new Pool({
		application_name: applicationName,
		connectionString,
		connectionTimeoutMillis: RealHotKeyMutationTimeoutMilliseconds,
		idleTimeoutMillis: RealHotKeyMutationTimeoutMilliseconds,
		max: RealHotKeyPoolCapacity,
	});
	pool.on("error", (error) => {
		poolErrors++;
		unexpectedErrorExamples.add(
			"pool:" +
				(postgresErrorField(error, "code") ?? "no-code") +
				":" +
				(postgresErrorField(error, "constraint") ?? "no-constraint"),
		);
	});
	let maximumPoolConnectionsInUse = 0;
	let maximumPoolWaiting = 0;
	const samplePool = (connectionsInUse: number, waiting: number): void => {
		maximumPoolConnectionsInUse = Math.max(maximumPoolConnectionsInUse, connectionsInUse);
		maximumPoolWaiting = Math.max(maximumPoolWaiting, waiting);
	};
	const monitor = startLockWaitMonitor(admin, applicationName);
	const attemptLatencies: number[] = [];
	const busyDecisionLatencies: number[] = [];
	const requestLockWaitLatencies: number[] = [];
	const terminalLatencies: number[] = [];
	const expectedValues = new Map<string, -1 | 1>(
		fixture.profileIds.map((profileId) => [profileId, -1 as const]),
	);
	let attemptedTransactions = 0;
	let backpressuredAttempts = 0;
	let deadlocks = 0;
	let otherErrors = 0;
	let succeededRequests = 0;
	let terminalBackpressuredRequests = 0;
	let terminalDeadlockRequests = 0;
	let terminalOtherErrorRequests = 0;
	let terminalTimedOutRequests = 0;
	let timedOutAttempts = 0;
	const startedAt = performance.now();
	await Promise.all(
		fixture.profileIds.map(async (profileId, workerIndex) => {
			let committedValue: -1 | 1 = -1;
			for (
				let logicalIndex = workerIndex;
				logicalIndex < logicalRequests;
				logicalIndex += RealHotKeyConcurrency
			) {
				const terminalStartedAt = performance.now();
				const desiredValue: -1 | 1 = committedValue === 1 ? -1 : 1;
				let terminal = false;
				for (let retry = 0; retry <= RealHotKeyMaximumRetries; retry++) {
					attemptedTransactions++;
					const outcome = await runRealHotKeyAttempt(
						pool,
						fixture,
						profileId,
						desiredValue,
						samplePool,
						monitor,
					);
					attemptLatencies.push(outcome.latencyMilliseconds);
					requestLockWaitLatencies.push(outcome.lockWaitMilliseconds);
					if (outcome.outcome === "succeeded") {
						committedValue = desiredValue;
						expectedValues.set(profileId, desiredValue);
						succeededRequests++;
						terminal = true;
					} else if (outcome.outcome === "backpressured") {
						backpressuredAttempts++;
						busyDecisionLatencies.push(
							outcome.busyDecisionMilliseconds ?? outcome.latencyMilliseconds,
						);
						if (retry < RealHotKeyMaximumRetries) {
							const cap = RealHotKeyRetryCapsMilliseconds[retry] ?? 0;
							const jitter = (logicalIndex * 1103515245 + retry * 12345) % (cap + 1);
							await delay(jitter);
						} else {
							terminalBackpressuredRequests++;
							terminal = true;
						}
					} else {
						if (outcome.outcome === "deadlock") {
							deadlocks++;
							terminalDeadlockRequests++;
						} else if (outcome.outcome === "timedOut") {
							timedOutAttempts++;
							terminalTimedOutRequests++;
						} else {
							otherErrors++;
							terminalOtherErrorRequests++;
						}
						unexpectedErrorExamples.add(
							(outcome.code ?? "no-code") + ":" + (outcome.constraint ?? "no-constraint"),
						);
						terminal = true;
					}
					if (terminal) break;
				}
				terminalLatencies.push(performance.now() - terminalStartedAt);
			}
		}),
	);
	const durationMilliseconds = performance.now() - startedAt;
	await pool.end();
	const lockWaitMonitoring = await monitor.stop();
	if (lockWaitMonitoring.failed) unexpectedErrorExamples.add("lock-wait-monitor:failed");
	const walEnd = await currentInsertLsn(admin);
	const countersAfter = await readDatabaseCounters(admin);
	const parity = await verifyRealHotKeyParity(admin, fixture, expectedValues);
	const terminalLatency = summarizeLatencies(terminalLatencies, timedOutAttempts);
	const lockWaitEpisodeLatency = summarizeLatencies(lockWaitMonitoring.episodes, 0);
	const requestLockWaitLatency = summarizeLatencies(requestLockWaitLatencies, 0);
	const successfulCommitsPerSecond =
		durationMilliseconds === 0 ? 0 : succeededRequests / (durationMilliseconds / 1000);
	const maximumPoolUtilization = maximumPoolConnectionsInUse / RealHotKeyPoolCapacity;
	const effectiveServerConnectionCapacity =
		countersBefore.maxConnections -
		countersBefore.reservedConnections -
		countersBefore.superuserReservedConnections;
	if (effectiveServerConnectionCapacity < 1)
		throw new Error("PostgreSQL exposes no non-reserved client connection capacity");
	const peakServerConnections =
		countersBefore.activeClientConnections + maximumPoolConnectionsInUse;
	const maximumServerConnectionUtilization =
		peakServerConnections / effectiveServerConnectionCapacity;
	const attemptAccountingExact = realHotKeyAttemptAccountingIsExact({
		attemptedTransactions,
		backpressuredAttempts,
		deadlocks,
		otherErrors,
		succeededRequests,
		timedOutAttempts,
	});
	const terminalAccountingExact = realHotKeyTerminalAccountingIsExact({
		logicalRequests,
		succeededRequests,
		terminalBackpressuredRequests,
		terminalDeadlockRequests,
		terminalOtherErrorRequests,
		terminalTimedOutRequests,
	});
	const acceptance = {
		attemptAccountingExact,
		minimumSuccessfulCommits: succeededRequests >= 100,
		noDeadlocks: deadlocks === 0 && countersAfter.deadlocks === countersBefore.deadlocks,
		noLockWaitMonitorErrors: !lockWaitMonitoring.failed,
		noPartialWrites: parity.passed,
		noPoolErrors: poolErrors === 0,
		noPoolQueueing: maximumPoolWaiting === 0,
		noTimeouts: timedOutAttempts === 0,
		noUnexpectedErrors: otherErrors === 0 && poolErrors === 0,
		poolUtilizationBelowEightyPercent: maximumPoolUtilization < 0.8,
		serverConnectionCapacityAvailable:
			countersBefore.activeClientConnections + RealHotKeyConcurrency <=
			effectiveServerConnectionCapacity,
		serverConnectionUtilizationBelowEightyPercent: maximumServerConnectionUtilization < 0.8,
		successfulCommitsPerSecond: successfulCommitsPerSecond >= 100,
		terminalAccountingExact,
		terminalP95BelowOneHundredFiftyMilliseconds: terminalLatency.p95Milliseconds < 150,
		lockWaitP95BelowTwentyFiveMilliseconds: requestLockWaitLatency.p95Milliseconds < 25,
	};
	const passed = Object.values(acceptance).every(Boolean);
	const walBytes = await walBytesBetween(admin, walStart, walEnd);
	return {
		acceptance: { ...acceptance, passed },
		activeClientConnectionsBefore: countersBefore.activeClientConnections,
		attemptLatency: summarizeLatencies(attemptLatencies, timedOutAttempts),
		attemptedTransactions,
		authority: fixture.authority,
		backpressuredAttempts,
		busyDecisionLatency: summarizeLatencies(busyDecisionLatencies, 0),
		deadlocks,
		durationMilliseconds: Number(durationMilliseconds.toFixed(3)),
		effectiveServerConnectionCapacity,
		lockWaitEpisodeLatency,
		lockWaitMonitorFailed: lockWaitMonitoring.failed,
		logicalRequests,
		requestLockWaitLatency,
		maximumPoolConnectionsInUse,
		maximumPoolUtilization: Number(maximumPoolUtilization.toFixed(6)),
		maximumPoolWaiting,
		maximumServerConnectionUtilization: Number(maximumServerConnectionUtilization.toFixed(6)),
		otherErrors,
		poolErrors,
		parity,
		pathLength: fixture.pathLength,
		peakServerConnections,
		succeededRequests,
		successfulCommitsPerSecond: Number(successfulCommitsPerSecond.toFixed(3)),
		terminalBackpressuredRequests,
		terminalDeadlockRequests,
		terminalLatency,
		terminalOtherErrorRequests,
		terminalTimedOutRequests,
		timedOutAttempts,
		unexpectedErrorExamples: [...unexpectedErrorExamples].slice(0, 10),
		walBytes,
		walBytesPerSuccessfulCommit:
			succeededRequests === 0 ? null : Number((walBytes / succeededRequests).toFixed(3)),
	};
}

async function waitForWriterFenceLock(
	admin: Client,
	pid: number,
	mode: "ExclusiveLock" | "ShareLock",
	granted: boolean,
): Promise<void> {
	const deadline = performance.now() + 5_000;
	while (performance.now() < deadline) {
		const row = await queryOne(
			admin,
			advisoryLockCountRow,
			"select count(*)::text as count from pg_locks " +
				"where pid=$1 and locktype='advisory' and mode=$2 and granted=$3 " +
				"and classid=0::oid and objid=71011001::oid and objsubid=1",
			[pid, mode, granted],
		);
		if (row.count === 1) return;
		await delay(5);
	}
	throw new Error(
		"Timed out waiting for " + mode + " granted=" + granted + " on writer-fence key 71011001",
	);
}

async function proveWriterFenceSharedBarrier(
	admin: Client,
	connectionString: string,
): Promise<number> {
	const applicationName = "vndb-v11-fence-shared-barrier";
	const pool = new Pool({
		application_name: applicationName,
		connectionString,
		max: RealHotKeyPoolCapacity,
	});
	pool.on("error", (error) => console.error("Idle writer-fence barrier Pool error", error));
	let acquired = 0;
	let markAllAcquired: (() => void) | undefined;
	const allAcquired = new Promise<void>((resolve) => {
		markAllAcquired = resolve;
	});
	let releaseBarrier: (() => void) | undefined;
	const barrier = new Promise<void>((resolve) => {
		releaseBarrier = resolve;
	});
	const holders = Array.from({ length: RealHotKeyConcurrency }, async () => {
		const connection = await pool.connect();
		try {
			await connection.query("begin");
			await connection.query("set local rezics.vndb_v11_binary_contract = 'vndb-v11-contract-v1'");
			await connection.query(
				"update public.unit_structure_application_judgment " +
					"set updated_at=updated_at where false",
			);
			acquired++;
			if (acquired === RealHotKeyConcurrency) markAllAcquired?.();
			await barrier;
			await connection.query("commit");
		} catch (error) {
			await connection.query("rollback").catch(() => undefined);
			throw error;
		} finally {
			connection.release();
		}
	});
	const holdersComplete = Promise.all(holders);
	try {
		await Promise.race([
			allAcquired,
			holdersComplete.then(() => {
				throw new Error("Writer-fence holders completed before reaching the barrier");
			}),
			delay(5_000).then(() => {
				throw new Error("Timed out acquiring 64 shared writer-fence locks");
			}),
		]);
		const proof = await queryOne(
			admin,
			writerFenceLockProofRow,
			"select count(*) filter (where locks.mode='ShareLock' and locks.granted)::text " +
				'as "grantedShareLocks",count(*)::text as "totalLocks" ' +
				"from pg_locks locks join pg_stat_activity activity on activity.pid=locks.pid " +
				"where activity.application_name=$1 and locks.locktype='advisory' " +
				"and locks.classid=0::oid and locks.objid=71011001::oid and locks.objsubid=1",
			[applicationName],
		);
		if (
			proof.grantedShareLocks !== RealHotKeyConcurrency ||
			proof.totalLocks !== RealHotKeyConcurrency
		)
			throw new Error(
				"Expected exactly 64 granted shared writer-fence locks; received " + JSON.stringify(proof),
			);
		return proof.grantedShareLocks;
	} finally {
		releaseBarrier?.();
		await holdersComplete.catch(() => undefined);
		await pool.end();
	}
}

async function measureWriterFenceTransactions(
	admin: Client,
	connectionString: string,
	fenced: boolean,
	samples: number,
): Promise<
	Readonly<{
		latency: LatencySummary;
		maximumPoolConnectionsInUse: number;
		maximumPoolWaiting: number;
		walBytes: number;
	}>
> {
	const pool = new Pool({
		application_name: fenced ? "vndb-v11-fence-open" : "vndb-v11-fence-baseline",
		connectionString,
		max: RealHotKeyPoolCapacity,
	});
	pool.on("error", (error) => console.error("Idle writer-fence Pool error", error));
	const latencies: number[] = [];
	let maximumPoolConnectionsInUse = 0;
	let maximumPoolWaiting = 0;
	const walStart = await currentInsertLsn(admin);
	try {
		await Promise.all(
			Array.from({ length: RealHotKeyConcurrency }, async (_, workerIndex) => {
				for (
					let logicalIndex = workerIndex;
					logicalIndex < samples;
					logicalIndex += RealHotKeyConcurrency
				) {
					const startedAt = performance.now();
					const connection = await pool.connect();
					maximumPoolConnectionsInUse = Math.max(
						maximumPoolConnectionsInUse,
						pool.totalCount - pool.idleCount,
					);
					maximumPoolWaiting = Math.max(maximumPoolWaiting, pool.waitingCount);
					try {
						await connection.query("begin");
						await connection.query(
							"set local rezics.vndb_v11_binary_contract = 'vndb-v11-contract-v1'",
						);
						await connection.query(
							fenced
								? "update public.unit_structure_application_judgment " +
										"set updated_at=updated_at where false"
								: "select 1",
						);
						await connection.query("commit");
					} catch (error) {
						await connection.query("rollback").catch(() => undefined);
						throw error;
					} finally {
						connection.release();
					}
					latencies.push(performance.now() - startedAt);
				}
			}),
		);
	} finally {
		await pool.end();
	}
	const walEnd = await currentInsertLsn(admin);
	return {
		latency: summarizeLatencies(latencies, 0),
		maximumPoolConnectionsInUse,
		maximumPoolWaiting,
		walBytes: await walBytesBetween(admin, walStart, walEnd),
	};
}

async function verifyWriterFenceIsolationGuard(
	connectionString: string,
	isolation: "repeatable read" | "serializable",
): Promise<boolean> {
	const client = createDisposableCapacityClient(connectionString);
	await client.connect();
	try {
		await client.query("begin isolation level " + isolation);
		await client.query("set local rezics.vndb_v11_binary_contract = 'vndb-v11-contract-v1'");
		try {
			await client.query(
				"update public.unit_structure_application_judgment " +
					"set updated_at=updated_at where false",
			);
			return false;
		} catch (error) {
			return (
				postgresErrorField(error, "code") === "55000" &&
				postgresErrorField(error, "constraint") === "vndb_v11_cutover_read_committed_required"
			);
		}
	} finally {
		await client.query("rollback").catch(() => undefined);
		await client.end();
	}
}

async function runWriterFenceBenchmark(
	connectionString: string,
	samples: number,
): Promise<WriterFenceSummary> {
	const admin = createDisposableCapacityClient(connectionString);
	const holder = createDisposableCapacityClient(connectionString);
	const pauser = createDisposableCapacityClient(connectionString);
	const queuedWriter = createDisposableCapacityClient(connectionString);
	await Promise.all([admin.connect(), holder.connect(), pauser.connect(), queuedWriter.connect()]);
	const measuredSamples = Math.max(RealHotKeyMinimumLogicalRequests, samples);
	try {
		const initialControl = await queryOne(
			admin,
			cutoverControlEpochRow,
			'select state as "controlState",transition_epoch::text as "transitionEpoch" ' +
				"from public.vndb_v11_cutover_control where id=1",
		);
		if (initialControl.controlState !== "postcontract_open")
			throw new Error("Writer-fence benchmark requires postcontract_open initial state");
		const repeatableReadRejected = await verifyWriterFenceIsolationGuard(
			connectionString,
			"repeatable read",
		);
		const serializableRejected = await verifyWriterFenceIsolationGuard(
			connectionString,
			"serializable",
		);
		const sharedBarrierGrantedLocks = await proveWriterFenceSharedBarrier(admin, connectionString);
		for (const client of [admin, holder, queuedWriter])
			await client.query("set rezics.vndb_v11_binary_contract = 'vndb-v11-contract-v1'");
		const baseline = await measureWriterFenceTransactions(
			admin,
			connectionString,
			false,
			measuredSamples,
		);
		const fenced = await measureWriterFenceTransactions(
			admin,
			connectionString,
			true,
			measuredSamples,
		);
		await holder.query("begin");
		await holder.query(
			"update public.unit_structure_application_judgment set updated_at=updated_at where false",
		);
		const holderPid = (await queryOne(holder, backendPidRow, "select pg_backend_pid() as pid")).pid;
		const pauserPid = (await queryOne(pauser, backendPidRow, "select pg_backend_pid() as pid")).pid;
		const queuedWriterPid = (
			await queryOne(queuedWriter, backendPidRow, "select pg_backend_pid() as pid")
		).pid;
		await waitForWriterFenceLock(admin, holderPid, "ShareLock", true);
		await pauser.query("begin");
		await pauser.query("set local statement_timeout = '5000ms'");
		let pauseFinished = false;
		let pauseError: unknown;
		const drainStartedAt = performance.now();
		const pause = pauser
			.query(
				"update public.vndb_v11_cutover_control set state='paused'," +
					"transition_epoch=transition_epoch+1,state_changed_at=now()," +
					"operator='capacity benchmark',reason='writer drain proof' where id=1",
			)
			.then(
				() => {
					pauseFinished = true;
				},
				(error: unknown) => {
					pauseError = error;
					pauseFinished = true;
				},
			);
		await waitForWriterFenceLock(admin, pauserPid, "ExclusiveLock", false);
		await queuedWriter.query("begin");
		await queuedWriter.query("set local statement_timeout = '5000ms'");
		let queuedFinished = false;
		const queuedWrite = queuedWriter
			.query(
				"update public.unit_structure_application_judgment set updated_at=updated_at where false",
			)
			.then(
				() => ({ code: undefined, constraint: undefined, succeeded: true }),
				(error: unknown) => ({
					code: postgresErrorField(error, "code"),
					constraint: postgresErrorField(error, "constraint"),
					succeeded: false,
				}),
			)
			.finally(() => {
				queuedFinished = true;
			});
		await waitForWriterFenceLock(admin, queuedWriterPid, "ShareLock", false);
		const blockedBeforeInFlightCommit = !pauseFinished;
		const queuedBehindExclusiveWaiter = !queuedFinished;
		await holder.query("commit");
		await pause;
		if (pauseError) throw pauseError;
		await waitForWriterFenceLock(admin, pauserPid, "ExclusiveLock", true);
		const drainWaitMilliseconds = performance.now() - drainStartedAt;
		await waitForWriterFenceLock(admin, queuedWriterPid, "ShareLock", false);
		const queuedUntilPauseCommit = !queuedFinished;
		await pauser.query("commit");
		const queuedOutcome = await queuedWrite;
		await queuedWriter.query("rollback").catch(() => undefined);
		const queuedWriterRejectedAfterPause =
			!queuedOutcome.succeeded &&
			queuedOutcome.code === "55000" &&
			queuedOutcome.constraint === "vndb_v11_writers_paused";
		const baselineSummary = baseline.latency;
		const fencedSummary = fenced.latency;
		const p95OverheadMilliseconds = Number(
			(fencedSummary.p95Milliseconds - baselineSummary.p95Milliseconds).toFixed(3),
		);
		const maximumPoolConnectionsInUse = Math.max(
			baseline.maximumPoolConnectionsInUse,
			fenced.maximumPoolConnectionsInUse,
		);
		const maximumPoolWaiting = Math.max(baseline.maximumPoolWaiting, fenced.maximumPoolWaiting);
		const maximumPoolUtilization = maximumPoolConnectionsInUse / RealHotKeyPoolCapacity;
		const finalControl = await queryOne(
			admin,
			cutoverControlEpochRow,
			'select state as "controlState",transition_epoch::text as "transitionEpoch" ' +
				"from public.vndb_v11_cutover_control where id=1",
		);
		if (finalControl.controlState !== "paused")
			throw new Error("Writer-fence benchmark did not leave the disposable database paused");
		return {
			drain: {
				blockedBeforeInFlightCommit,
				drainWaitMilliseconds: Number(drainWaitMilliseconds.toFixed(3)),
				passed:
					blockedBeforeInFlightCommit &&
					queuedBehindExclusiveWaiter &&
					queuedUntilPauseCommit &&
					queuedWriterRejectedAfterPause,
				queuedWriterBlockedBehindPause: queuedBehindExclusiveWaiter && queuedUntilPauseCommit,
				queuedWriterRejectedAfterPause,
			},
			finalState: {
				controlState: finalControl.controlState,
				passed: finalControl.transitionEpoch === initialControl.transitionEpoch + 1,
				requiresEpochBoundResume: true,
				transitionEpoch: finalControl.transitionEpoch,
			},
			openState: {
				baselineTransactionLatency: baselineSummary,
				baselineWalBytes: baseline.walBytes,
				concurrency: RealHotKeyConcurrency,
				fencedTransactionLatency: fencedSummary,
				fencedWalBytes: fenced.walBytes,
				maximumPoolConnectionsInUse,
				maximumPoolUtilization: Number(maximumPoolUtilization.toFixed(6)),
				maximumPoolWaiting,
				passed:
					fencedSummary.p95Milliseconds < 25 &&
					p95OverheadMilliseconds < 5 &&
					maximumPoolUtilization < 0.8 &&
					sharedBarrierGrantedLocks === RealHotKeyConcurrency,
				p95OverheadMilliseconds,
				sharedBarrierGrantedLocks,
				sharedBarrierPassed: sharedBarrierGrantedLocks === RealHotKeyConcurrency,
				samples: measuredSamples,
				walOverheadBytes: fenced.walBytes - baseline.walBytes,
			},
			isolationGuard: {
				passed: repeatableReadRejected && serializableRejected,
				repeatableReadRejected,
				serializableRejected,
			},
		};
	} finally {
		await Promise.all([
			holder.query("rollback").catch(() => undefined),
			pauser.query("rollback").catch(() => undefined),
			queuedWriter.query("rollback").catch(() => undefined),
		]);
		await Promise.all([admin.end(), holder.end(), pauser.end(), queuedWriter.end()]);
	}
}

async function runRealHotKeyBenchmark(
	client: Client,
	connectionString: string,
	sampleCount: number,
	readiness: z.infer<typeof realHotKeyReadinessRow>,
): Promise<RealHotKeyBenchmarkSummary> {
	if (!realHotKeySchemaReady(readiness))
		return {
			acceptance: {
				passed: false,
				reasons: ["Real migrated trigger/FK/admission/fence schema is not ready"],
			},
			readiness,
			scenarios: [],
			status: "pending",
			writerFence: null,
		};
	if (readiness.controlState !== "postcontract_open")
		throw new Error("Real benchmark requires the final postcontract_open writer-fence state");
	await client.query("set rezics.vndb_v11_binary_contract = 'vndb-v11-contract-v1'");
	const seed = buildRealHotKeySeed();
	const scenarios: RealHotKeyScenarioSummary[] = [];
	try {
		await seedRealHotKeyFixtures(client, seed);
		const logicalRequests = Math.max(RealHotKeyMinimumLogicalRequests, sampleCount);
		for (const fixture of seed.fixtures)
			scenarios.push(
				await runRealHotKeyScenario(client, connectionString, fixture, logicalRequests),
			);
	} finally {
		await cleanupRealHotKeySeed(client, seed);
		await assertRealHotKeySeedAbsent(client, seed);
	}
	// Run the destructive drain proof only after all final-schema writes and cleanup. A successful
	// proof intentionally leaves this disposable database paused: only the epoch-bound cutover
	// verifier may authorize a resume, and a capacity fixture must never bypass that contract.
	const writerFence = await runWriterFenceBenchmark(connectionString, sampleCount);
	const reasons = scenarios
		.filter((scenario) => !scenario.acceptance.passed)
		.map((scenario) => scenario.authority + "-L" + scenario.pathLength + " failed");
	if (!writerFence.drain.passed) reasons.push("Writer fence failed to drain an in-flight writer");
	if (!writerFence.finalState.passed)
		reasons.push("Writer fence did not advance exactly one epoch and remain paused");
	if (!writerFence.isolationGuard.passed)
		reasons.push("Writer fence accepted a stale-snapshot isolation level");
	if (!writerFence.openState.passed) reasons.push("Open writer fence regressed transaction p95");
	return {
		acceptance: { passed: reasons.length === 0, reasons },
		readiness,
		scenarios,
		status: reasons.length === 0 ? "passed" : "failed",
		writerFence,
	};
}

async function main(): Promise<void> {
	if (!process.argv.includes("--yes"))
		throw new Error("VNDB v11 capacity fixture creation requires explicit --yes confirmation");
	if (process.env.VNDB_V11_CAPACITY_DISPOSABLE !== FixtureIdentity)
		throw new Error(`${FixtureIdentity} must be set in VNDB_V11_CAPACITY_DISPOSABLE`);
	const rowCount = readPositiveIntegerFlag(
		"--rows",
		MinimumRepresentativeRows,
		MaximumRepresentativeRows,
	);
	if (rowCount < MinimumRepresentativeRows)
		throw new RangeError(
			`--rows must be at least ${MinimumRepresentativeRows.toLocaleString("en")}`,
		);
	const sampleCount = readPositiveIntegerFlag("--samples", 128, 4096);
	const outputPath = readStringFlag("--output");
	const connectionString = process.env.DATABASE_ADMIN_URL;
	if (!connectionString) throw new Error("DATABASE_ADMIN_URL is required");
	const client = createDisposableCapacityClient(connectionString);
	await client.connect();
	try {
		await client.query("set statement_timeout = 0");
		await client.query("set synchronous_commit = off");
		const realHotKeyReadiness = await readRealHotKeyReadiness(client);
		const realHotKeyBenchmark = await runRealHotKeyBenchmark(
			client,
			connectionString,
			sampleCount,
			realHotKeyReadiness,
		);
		const layoutLoad = await createFixture(client, rowCount);
		const relationShapeLoadMilliseconds = await createRelationShapes(client, rowCount);
		const realmUnitTagRouteLoad = await createRealmUnitTagRouteShape(client, rowCount);
		const importerEvidenceLoads = await createImporterEvidenceShapes(client, rowCount);
		const overlap = await queryOne(
			client,
			overlapRow,
			`select count(*)::text as "rowCount",
			count(*) filter (where fit_vote is not null)::text as "fitCount",
			count(*) filter (where spoiler_level is not null)::text as "spoilerCount",
			count(*) filter (where fit_vote is not null and spoiler_level is not null)::text as "bothCount",
			count(*) filter (where fit_vote is not null and spoiler_level is null)::text as "fitOnlyCount",
			count(*) filter (where fit_vote is null and spoiler_level is not null)::text as "spoilerOnlyCount"
		 from ${FixtureSchema}.co_judgment`,
		);
		if (overlap.rowCount !== rowCount)
			throw new Error(
				`Expected ${rowCount.toLocaleString("en")} unique logical judgments, created ${overlap.rowCount.toLocaleString("en")}`,
			);
		const hotKey = await queryOne(
			client,
			hotKeyRow,
			`select unit_id::text as "unitId", target_id::text as "targetId",
			(array_agg(profile_id order by profile_id))[1]::text as "profileId"
		 from ${FixtureSchema}.co_judgment
		 group by unit_id, target_id order by count(*) desc limit 1`,
		);
		const plans = {
			coLocatedAggregate: await explain(
				client,
				`select count(*) filter (where fit_vote = 1),
				count(*) filter (where fit_vote = -1),
				count(*) filter (where spoiler_level = 0),
				count(*) filter (where spoiler_level = 1),
				count(*) filter (where spoiler_level = 2)
			 from ${FixtureSchema}.co_judgment where unit_id = $1 and target_id = $2`,
				[hotKey.unitId, hotKey.targetId],
			),
			coLocatedViewer: await explain(
				client,
				`select fit_vote, spoiler_level from ${FixtureSchema}.co_judgment
			 where unit_id = $1 and target_id = $2 and profile_id = $3`,
				[hotKey.unitId, hotKey.targetId, hotKey.profileId],
			),
			splitFitAggregate: await explain(
				client,
				`select count(*) filter (where fit_vote = 1), count(*) filter (where fit_vote = -1)
			 from ${FixtureSchema}.split_fit_judgment where unit_id = $1 and target_id = $2`,
				[hotKey.unitId, hotKey.targetId],
			),
			splitSpoilerAggregate: await explain(
				client,
				`select count(*) filter (where spoiler_level = 0),
				count(*) filter (where spoiler_level = 1), count(*) filter (where spoiler_level = 2)
			 from ${FixtureSchema}.split_spoiler_judgment where unit_id = $1 and target_id = $2`,
				[hotKey.unitId, hotKey.targetId],
			),
			legacyUnitTagMillionProfileRescan: await explain(
				client,
				`select coalesce(sum(fit_vote), 0), count(fit_vote), count(spoiler_level),
					count(*) filter (where spoiler_level = 0),
					count(*) filter (where spoiler_level = 1),
					count(*) filter (where spoiler_level = 2)
			 from ${FixtureSchema}.skew_unit_tag_judgment
			 where unit_id = md5('skew-unit-tag-unit')::uuid
				and tag_id = md5('skew-unit-tag-tag')::uuid`,
			),
			finalUnitTagSemanticDelta: await explain(
				client,
				`update ${FixtureSchema}.unit_tag_judgment_stat
			 set score = score + 1, vote_count = vote_count + 1,
				spoiler_vote_count = spoiler_vote_count + 1,
				spoiler_major_count = spoiler_major_count + 1,
				updated_at = now()
			 where unit_id = md5('stat-unit:1')::uuid
				and tag_id = md5('stat-tag:2')::uuid`,
			),
			legacyStructureMillionProfileRescan: await explain(
				client,
				`select coalesce(sum(fit_vote), 0), count(fit_vote), count(spoiler_level),
					count(*) filter (where spoiler_level = 0),
					count(*) filter (where spoiler_level = 1),
					count(*) filter (where spoiler_level = 2)
			 from ${FixtureSchema}.skew_structure_application_judgment
			 where unit_id = md5('skew-structure-unit')::uuid
				and structure_id = md5('skew-structure')::uuid`,
			),
			finalStructureSemanticDelta: await explain(
				client,
				`update ${FixtureSchema}.unit_structure_application_judgment_stat
			 set score = score + 1, vote_count = vote_count + 1,
				spoiler_vote_count = spoiler_vote_count + 1,
				spoiler_major_count = spoiler_major_count + 1,
				updated_at = now()
			 where unit_id = md5('stat-unit:1')::uuid
				and structure_id = md5('stat-structure:1')::uuid`,
			),
			legacyRealmMillionProfileRescan: await explain(
				client,
				`select coalesce(sum(fit_vote), 0), count(fit_vote), count(spoiler_level),
					count(*) filter (where spoiler_level = 0),
					count(*) filter (where spoiler_level = 1),
					count(*) filter (where spoiler_level = 2)
			 from ${FixtureSchema}.skew_realm_tag_judgment
			 where realm_id = md5('skew-realm')::uuid
				and unit_id = md5('skew-realm-unit')::uuid
				and tag_id = md5('skew-realm-tag')::uuid`,
			),
			finalRealmSemanticDelta: await explain(
				client,
				`update ${FixtureSchema}.realm_tag_judgment_stat
			 set score = score + 1, vote_count = vote_count + 1,
				spoiler_vote_count = spoiler_vote_count + 1,
				spoiler_major_count = spoiler_major_count + 1,
				updated_at = now()
			 where realm_id = md5('stat-realm:2')::uuid
				and unit_id = md5('stat-unit:1')::uuid
				and tag_id = md5('stat-tag:2')::uuid`,
			),
			legacySubjectMillionProfileRescan: await explain(
				client,
				`select count(*), count(*) filter (where spoiler_level = 0),
					count(*) filter (where spoiler_level = 1),
					count(*) filter (where spoiler_level = 2)
			 from ${FixtureSchema}.skew_subject_association_judgment
			 where association_id = md5('skew-association')::uuid`,
			),
			finalSubjectSemanticDelta: await explain(
				client,
				`update ${FixtureSchema}.subject_association_judgment_stat
			 set spoiler_vote_count = spoiler_vote_count + 1,
				spoiler_major_count = spoiler_major_count + 1,
				updated_at = now()
			 where association_id = md5('stat-association:1')::uuid`,
			),
			legacyStructureSupportMillionFanInRescan: await explain(
				client,
				`select count(*) from ${FixtureSchema}.skew_structure_support
			 where unit_id = md5('skew-support-unit')::uuid
				and tag_id = md5('skew-support-tag')::uuid`,
			),
			finalStructureSupportDelta: await explain(
				client,
				`update ${FixtureSchema}.global_effective_tag
			 set structure_support_count = structure_support_count + 1, updated_at = now()
			 where unit_id = md5('unit:1')::uuid and tag_id = md5('tag:2')::uuid`,
			),
			targetBrowse: await explain(
				client,
				`select unit_id, fit_vote, spoiler_level from ${FixtureSchema}.co_judgment
			 where target_id = $1 order by unit_id limit 50`,
				[hotKey.targetId],
			),
			structureEndsAt: await explain(
				client,
				`select structure_id from ${FixtureSchema}.structure_ends_at
			 where final_tag_id = md5('tag:1')::uuid order by structure_id limit 50`,
			),
			primaryCandidateHotEndpointSeek: await explain(
				client,
				`select structure_id, projection_version
			 from ${FixtureSchema}.unit_structure_primary_path_candidate
			 where final_tag_id = md5('primary-candidate-hot-final')::uuid and accepted
			 order by wilson_lower_bound desc, score desc, vote_count desc,
				structure_id, projection_version limit 1`,
			),
			realmUnitTagTagCascade: await explain(
				client,
				"select realm_id,unit_id from " +
					FixtureSchema +
					".realm_unit_tag_route where tag_id=md5('route-hot-tag')::uuid",
			),
			realmUnitTagRealmUnitCascade: await explain(
				client,
				"select tag_id from " +
					FixtureSchema +
					".realm_unit_tag_route where realm_id=md5('route-realm:2')::uuid " +
					"and unit_id=md5('route-unit:1')::uuid",
			),
			realmUnitTagUnitMerge: await explain(
				client,
				"select realm_id,tag_id from " +
					FixtureSchema +
					".realm_unit_tag_route where unit_id=md5('route-unit:1')::uuid",
			),
		};
		requireIndex(
			"co-located aggregate",
			plans.coLocatedAggregate,
			"co_judgment_pkey",
			"co_judgment_target_idx",
			"co_judgment_profile_idx",
		);
		requireIndex(
			"co-located viewer",
			plans.coLocatedViewer,
			"co_judgment_pkey",
			"co_judgment_target_idx",
			"co_judgment_profile_idx",
		);
		requireIndex(
			"split fit aggregate",
			plans.splitFitAggregate,
			"split_fit_judgment_pkey",
			"split_fit_judgment_target_idx",
		);
		requireIndex(
			"split spoiler aggregate",
			plans.splitSpoilerAggregate,
			"split_spoiler_judgment_pkey",
			"split_spoiler_judgment_target_idx",
		);
		requireIndex(
			"final Unit-Tag semantic delta",
			plans.finalUnitTagSemanticDelta,
			"unit_tag_judgment_stat_pkey",
		);
		requireIndex(
			"final structure-application semantic delta",
			plans.finalStructureSemanticDelta,
			"unit_structure_application_judgment_stat_pkey",
		);
		requireIndex(
			"final Realm semantic delta",
			plans.finalRealmSemanticDelta,
			"realm_tag_judgment_stat_pkey",
			"realm_tag_judgment_stat_realm_tag_unit_idx",
			"realm_tag_judgment_stat_tag_realm_unit_idx",
			"realm_tag_judgment_stat_unit_realm_tag_idx",
		);
		requireIndex(
			"final subject-association semantic delta",
			plans.finalSubjectSemanticDelta,
			"subject_association_judgment_stat_pkey",
		);
		requireIndex(
			"final structure-support count delta",
			plans.finalStructureSupportDelta,
			"global_effective_tag_pkey",
		);
		requireIndex("target browse", plans.targetBrowse, "co_judgment_target_idx");
		requireIndex("structure ends-at", plans.structureEndsAt, "structure_ends_at_tag_idx");
		requireIndex(
			"primary candidate hot-endpoint seek",
			plans.primaryCandidateHotEndpointSeek,
			"unit_structure_primary_path_candidate_rank_idx",
		);
		requireIndex(
			"Realm Tag parent cascade",
			plans.realmUnitTagTagCascade,
			"realm_unit_tag_tag_route_idx",
		);
		requireIndex(
			"Realm/Unit parent cascade",
			plans.realmUnitTagRealmUnitCascade,
			"realm_unit_tag_route_pkey",
		);
		requireIndex(
			"Realm Unit merge cleanup",
			plans.realmUnitTagUnitMerge,
			"realm_unit_tag_unit_merge_idx",
		);

		await prepareWriteBenchmarks(client);
		const aggregateMaintenance = await runAggregateMaintenance(client, sampleCount);
		const quickAdd: QuickAddSummary[] = [];
		for (const length of [2, 4, 16]) quickAdd.push(await runQuickAdd(client, length, sampleCount));
		const hotKeyConcurrency: Record<string, { global: LatencySummary; realm: LatencySummary }> = {};
		for (const concurrency of [1, 16, 64]) {
			hotKeyConcurrency[String(concurrency)] = {
				global: await runHotKeyTier(connectionString, concurrency, sampleCount, false),
				realm: await runHotKeyTier(connectionString, concurrency, sampleCount, true),
			};
		}
		const sizes = await relationSizes(client);
		const runtime = await queryOne(
			client,
			runtimeRow,
			`select pg_database_size(current_database())::text as "databaseBytes",
			current_setting('server_version') as "serverVersion",
			current_setting('shared_buffers') as "sharedBuffers",
			current_setting('work_mem') as "workMem"`,
		);
		const byName = new Map<string, z.infer<typeof relationSizeRow>>();
		for (const row of sizes) byName.set(row.tableName, row);
		const importerEvidence = importerEvidenceCapacity(byName, importerEvidenceLoads);
		const coLocated = byName.get("co_judgment");
		const splitFit = byName.get("split_fit_judgment");
		const splitSpoiler = byName.get("split_spoiler_judgment");
		if (!coLocated || !splitFit || !splitSpoiler)
			throw new Error("Layout size evidence is incomplete");
		const aggregateCapacity: Readonly<
			Record<AggregateProjectionName, AggregateCapacityProjection>
		> = {
			unit_tag_judgment_stat: aggregateCapacityProjection(
				requireRelationSize(byName, "unit_tag_judgment_stat"),
			),
			unit_structure_application_judgment_stat: aggregateCapacityProjection(
				requireRelationSize(byName, "unit_structure_application_judgment_stat"),
			),
			realm_tag_judgment_stat: aggregateCapacityProjection(
				requireRelationSize(byName, "realm_tag_judgment_stat"),
			),
			subject_association_judgment_stat: aggregateCapacityProjection(
				requireRelationSize(byName, "subject_association_judgment_stat"),
			),
		};
		const primaryPathCandidateCapacity = aggregateCapacityProjection(
			requireRelationSize(byName, "unit_structure_primary_path_candidate"),
		);
		const realmUnitTagRouteCapacity = aggregateCapacityProjection(
			requireRelationSize(byName, "realm_unit_tag_route"),
		);
		const aggregateCapacityValues = Object.values(aggregateCapacity);
		const aggregateFourTableCapacity = {
			heapGiBAtFiveHundredMillionRowsEach: Number(
				aggregateCapacityValues
					.reduce((sum, capacity) => sum + capacity.heapGiBAtFiveHundredMillionRows, 0)
					.toFixed(3),
			),
			heapGiBAtThreeBillionRowsEach: Number(
				aggregateCapacityValues
					.reduce((sum, capacity) => sum + capacity.heapGiBAtThreeBillionRows, 0)
					.toFixed(3),
			),
			indexGiBAtFiveHundredMillionRowsEach: Number(
				aggregateCapacityValues
					.reduce((sum, capacity) => sum + capacity.indexGiBAtFiveHundredMillionRows, 0)
					.toFixed(3),
			),
			indexGiBAtThreeBillionRowsEach: Number(
				aggregateCapacityValues
					.reduce((sum, capacity) => sum + capacity.indexGiBAtThreeBillionRows, 0)
					.toFixed(3),
			),
			totalGiBAtFiveHundredMillionRowsEach: Number(
				aggregateCapacityValues
					.reduce((sum, capacity) => sum + capacity.totalGiBAtFiveHundredMillionRows, 0)
					.toFixed(3),
			),
			totalGiBAtThreeBillionRowsEach: Number(
				aggregateCapacityValues
					.reduce((sum, capacity) => sum + capacity.totalGiBAtThreeBillionRows, 0)
					.toFixed(3),
			),
		};
		const aggregateFourTableWal = Object.fromEntries(
			(["insertBranch", "updateBranch", "delete"] as const).map((operation) => {
				const walBytesForOneWritePerFamily = Object.values(aggregateMaintenance).reduce(
					(sum, maintenance) => sum + maintenance[operation].walBytesPerWrite,
					0,
				);
				return [
					operation,
					{
						primaryWalMegabytesPerSecondAtTwentyThousandWritesPerFamily: Number(
							((walBytesForOneWritePerFamily * 20_000) / 1_000_000).toFixed(3),
						),
						twoReplicaNetworkMegabytesPerSecondAtTwentyThousandWritesPerFamily: Number(
							((walBytesForOneWritePerFamily * 20_000 * 2) / 1_000_000).toFixed(3),
						),
						walBytesForOneWritePerFamily,
					},
				];
			}),
		);
		const stagingWalBytesPerRowProxy = Math.max(
			...quickAdd.map((summary) => summary.walBytesPerRowMutation),
		);
		const stageProjection = (
			relationName: string,
		): Readonly<{
			peakGiBAtFiveHundredMillionRows: number;
			peakGiBAtThreeBillionRows: number;
			peakWithThirtyPercentHeadroomGiBAtFiveHundredMillionRows: number;
			peakWithThirtyPercentHeadroomGiBAtThreeBillionRows: number;
			stagingWalGiBAtFiveHundredMillionRows: number;
			stagingWalGiBAtThreeBillionRows: number;
		}> => {
			const capacity = aggregateCapacityProjection(requireRelationSize(byName, relationName));
			return {
				peakGiBAtFiveHundredMillionRows: Number(
					(capacity.totalGiBAtFiveHundredMillionRows * 2).toFixed(3),
				),
				peakGiBAtThreeBillionRows: Number((capacity.totalGiBAtThreeBillionRows * 2).toFixed(3)),
				peakWithThirtyPercentHeadroomGiBAtFiveHundredMillionRows: Number(
					(capacity.totalGiBAtFiveHundredMillionRows * 2.6).toFixed(3),
				),
				peakWithThirtyPercentHeadroomGiBAtThreeBillionRows: Number(
					(capacity.totalGiBAtThreeBillionRows * 2.6).toFixed(3),
				),
				stagingWalGiBAtFiveHundredMillionRows: Number(
					((stagingWalBytesPerRowProxy * 500_000_000) / 1024 ** 3).toFixed(3),
				),
				stagingWalGiBAtThreeBillionRows: Number(
					((stagingWalBytesPerRowProxy * 3_000_000_000) / 1024 ** 3).toFixed(3),
				),
			};
		};
		const report = {
			schemaVersion: 1,
			fixtureIdentity: FixtureIdentity,
			rowCount,
			sampleCount,
			sourceDistribution: {
				description:
					"VNDB 2026-08-23 tags_vn-inspired distribution plus a 5% spoiler-only product allowance",
				fitOnlyPermille: 612,
				bothPermille: 338,
				spoilerOnlyPermille: 50,
			},
			overlap,
			layoutLoad,
			relationShapeLoadMilliseconds,
			layoutDecision: {
				coLocatedTotalBytes: coLocated.totalBytes,
				splitTotalBytes: splitFit.totalBytes + splitSpoiler.totalBytes,
				coLocatedBytesPerLogicalJudgment: coLocated.totalBytes / overlap.rowCount,
				splitBytesPerLogicalJudgment:
					(splitFit.totalBytes + splitSpoiler.totalBytes) / overlap.rowCount,
				coLocatedToSplitRatio:
					coLocated.totalBytes / (splitFit.totalBytes + splitSpoiler.totalBytes),
			},
			relationSizes: sizes,
			aggregateCapacityModel: {
				baselineRows: 500_000_000,
				upperProjectionRows: 3_000_000_000,
				indexEntriesPerRow: {
					realm_tag_judgment_stat: 4,
					subject_association_judgment_stat: 1,
					unit_structure_application_judgment_stat: 1,
					unit_tag_judgment_stat: 1,
				},
				measurementScope:
					"One million rows per exact heap/check/index shape; foreign keys are omitted to isolate stored projection bytes. Linear projections expose capacity order but exclude B-tree height transitions and future bloat.",
			},
			aggregateCapacity,
			aggregateFourTableCapacity,
			aggregateFourTableWal,
			pathGenerationStagingModel: {
				cardinality:
					"Active and staged generations each reach the stated per-relation row baseline; peak storage is 2x before 30% operating headroom.",
				globalStructureSupport: stageProjection("global_support"),
				realmStructureSupport: stageProjection("realm_support"),
				structureEdgesProxy: stageProjection("global_definition_vote"),
				structureMembersProxy: stageProjection("structure_ends_at"),
				primaryPathCandidate: stageProjection("unit_structure_primary_path_candidate"),
				stagingWalBytesPerRowProxy,
				walScope:
					"The conservative WAL proxy is the largest measured mixed quick-add WAL per row mutation. A final-schema full-generation staging replay remains mandatory before procurement.",
			},
			importerEvidenceModel: {
				baselineRows: 500_000_000,
				upperProjectionRows: 3_000_000_000,
				measurementScope:
					"One million rows per immutable ledger/evidence heap and exact necessary index shape. Insert WAL includes index maintenance; foreign-key storage is zero in PostgreSQL and parent reads are excluded. Source keys remain payload-only.",
				evidenceFamilies: [
					"Unit-Tag judgment provenance",
					"Structure definition-vote provenance",
					"Structure-application judgment provenance",
					"subject-association judgment provenance",
					"Tag source policy provenance",
					"immutable pack manifest/source-lock/rights/binding snapshots",
				],
			},
			importerEvidence,
			primaryPathCandidateModel: {
				cardinality: "one row per Path projection version",
				fixtureDistribution:
					"One million accepted candidates share one final Tag, exercising the worst hot leaf and a fully populated partial rank index.",
				measurementScope:
					"Exact heap and partial-index columns with the production rank order; foreign-key storage is omitted because PostgreSQL does not create an index for the referencing side.",
			},
			primaryPathCandidateCapacity,
			realmUnitTagRouteModel: {
				capacity: realmUnitTagRouteCapacity,
				indexEntriesPerRow: 4,
				load: realmUnitTagRouteLoad,
				measurementScope:
					"One million exact rows with the source maximum 53,507-row hot Tag plus the production primary, Realm/Tag, Tag/Realm route, and Unit-merge indexes. WAL includes all four B-tree entries. EXPLAIN ANALYZE proves the Tag-parent, Realm/Unit-parent, and Unit-merge cleanup routes.",
				requiredPlans: [
					"realmUnitTagTagCascade",
					"realmUnitTagRealmUnitCascade",
					"realmUnitTagUnitMerge",
				],
			},
			aggregateMaintenanceModel: {
				physicalStatWritesPerRelevantDirectJudgmentMutation: 1,
				measurementScope:
					"One production-shaped aggregate-row INSERT-branch UPSERT, existing-row UPSERT, or DELETE per sample under intended single-refresh ownership. WAL uses pg_current_wal_insert_lsn inside one measured batch and excludes source-row WAL, foreign-key parent reads, advisory locks, per-request commit records, revision history, and the removed duplicate/no-op defect.",
			},
			aggregateMaintenance,
			boundedMaintenanceModel: {
				highFanInRowsPerHotKey: rowCount,
				legacyRescanPlans: [
					"legacyUnitTagMillionProfileRescan",
					"legacyStructureMillionProfileRescan",
					"legacyRealmMillionProfileRescan",
					"legacySubjectMillionProfileRescan",
					"legacyStructureSupportMillionFanInRescan",
				],
				finalSemanticDeltaPlans: [
					"finalUnitTagSemanticDelta",
					"finalStructureSemanticDelta",
					"finalRealmSemanticDelta",
					"finalSubjectSemanticDelta",
					"finalStructureSupportDelta",
				],
				finalComplexity:
					"One primary-key aggregate update from OLD/NEW semantic deltas; structure support changes the effective structure_support_count by +1 or -1 without counting sibling Profiles or Paths.",
				measurementScope:
					"Legacy plans intentionally aggregate one million sibling source rows. Final plans execute the bounded aggregate-row DML shape and assert its named primary index; a real migrated trigger/FK replay is a separate mandatory Phase 0 gate.",
			},
			plans,
			quickAddModel: {
				formula: "3 + 4L",
				pathLengths: [2, 4, 16],
				scenario: "fresh positive global Path application with projection keys absent",
				rowFamilies: [
					"application",
					"application judgment",
					"application judgment stat",
					"structure support per member",
					"effective Tag per member",
					"effective vote per member",
					"Tag judgment stat per member",
				],
				measurementScope:
					"Heap and production-shaped index WAL for the intended single-refresh projection fan-out; elapsed time is a set-based shape approximation and excludes production trigger rescans, advisory locks, revision history, and the removed duplicate/no-op aggregate refresh defect.",
			},
			quickAdd,
			hotKeyConcurrency,
			realHotKeyBenchmark,
			realHotKeyReadiness,
			runtime,
		} satisfies JsonValue;
		const serialized = `${JSON.stringify(report, null, 2)}\n`;
		if (outputPath) await writeFile(outputPath, serialized, "utf8");
		console.info(serialized.trimEnd());
		if (!realHotKeyBenchmark.acceptance.passed) {
			const reasons = realHotKeyBenchmark.acceptance.reasons.join("; ");
			throw new Error(
				"VNDB v11 capacity gate remains closed: " +
					(reasons || "real-schema benchmark did not pass"),
			);
		}
	} catch (error) {
		await client.query("rollback").catch(() => undefined);
		throw error;
	} finally {
		await client.end();
	}
}

if (import.meta.main) await main();
