import { createHash } from "node:crypto";

import type { Client } from "pg";
import { z } from "zod";

import {
	type VndbV11CutoverVerificationRelation,
	VndbV11CutoverVerificationContract,
	VndbV11CutoverVerificationRelationValues,
} from "../src/services/database/schema/vndb-v11-cutover-verification";

export const VndbV11CutoverVerificationCheckpointTable = "vndb_v11_cutover_verification_checkpoint";
export const VndbV11CutoverVerificationProofTable = "vndb_v11_cutover_verification_proof";
export const VndbV11PrimaryPathProjectionProofRelation =
	"unit_structure_primary_path_projection" satisfies VndbV11CutoverVerificationRelation;
export { VndbV11CutoverVerificationContract };

const CutoverControlTable = "vndb_v11_cutover_control";
const CutoverTransitionTable = "vndb_v11_cutover_transition";
const PrimaryPathBackfillProgressTable = "vndb_v11_primary_path_backfill_progress";
const PrimaryPathDirtyKeyTable = "vndb_v11_primary_path_dirty_key";
const MaximumVerificationRetries = 4;
const MaximumVerificationStatementMilliseconds = 30_000;
const TargetVerificationBatchMilliseconds = 500;
const PrimaryPathOnlineBackfillContract = "vndb-v11-primary-path-online-v1";

const uuidStringSchema = z.string().uuid();
const bigintStringSchema = z.string().regex(/^-?\d+$/);
const checksumSchema = z.string().regex(/^[0-9a-f]{64}$/);
const relationSchema = z.enum(VndbV11CutoverVerificationRelationValues);
const pausedEpochRowSchema = z
	.object({
		auditPaused: z.boolean(),
		epoch: z.string().regex(/^\d+$/),
		historyComplete: z.boolean(),
	})
	.strict();
const checkpointRowSchema = z
	.object({
		checksum: checksumSchema,
		completedAt: z.string().nullable(),
		accumulator: z.array(z.string()).max(8),
		accumulatorKey: z.array(uuidStringSchema).max(3),
		cursor: z.array(z.string()).max(5),
		relation: relationSchema,
		relationProof: checksumSchema.nullable(),
		scannedRowCount: z.string().regex(/^\d+$/),
		verificationContract: z.literal(VndbV11CutoverVerificationContract),
		verifiedRowCount: z.string().regex(/^\d+$/),
	})
	.strict();
const completedCheckpointRowSchema = checkpointRowSchema.extend({
	completedAt: z.string().min(1),
	relationProof: checksumSchema,
});
const globalProofRowSchema = z
	.object({
		completedAt: z.string().min(1),
		proof: checksumSchema,
		relationCount: z.number().int().positive(),
		verifiedBy: z.string().min(1),
		verifiedRowCount: z.string().regex(/^\d+$/),
	})
	.strict();

interface VerificationBatchResult {
	readonly accumulator: readonly string[];
	readonly accumulatorKey: readonly string[];
	readonly canonicalRows: readonly string[];
	readonly cursor: readonly string[];
	readonly scannedRows: number;
}

interface VerificationRelation {
	readonly keyColumns: readonly string[];
	readonly name: VndbV11CutoverVerificationRelation;
	readonly readBatch: (
		client: Client,
		batchSize: number,
		state: CheckpointState,
	) => Promise<VerificationBatchResult>;
}

interface TimestampVerificationSpec {
	readonly keyColumns: readonly string[];
	readonly relation: VndbV11CutoverVerificationRelation;
	readonly table: string;
}

interface AggregateSourceSpec {
	readonly accumulatorSql: string;
	readonly profileSql?: string;
	readonly table: string;
}

interface AggregateVerificationSpec {
	readonly accumulatorLength: number;
	readonly actualColumns: readonly string[];
	readonly actualTable: string;
	readonly keyColumns: readonly string[];
	readonly metricCount: number;
	readonly eligibilityIndex?: number;
	readonly presenceIndexes: readonly number[];
	readonly relation: VndbV11CutoverVerificationRelation;
	readonly sources: readonly AggregateSourceSpec[];
}

export interface CompletedVndbV11RelationProof {
	readonly checksum: string;
	readonly relation: VndbV11CutoverVerificationRelation;
	readonly relationProof: string;
	readonly verifiedRowCount: bigint;
}

const TimestampVerificationSpecs = [
	{
		relation: "unit_tag_judgment_timestamps",
		table: "unit_tag_judgment",
		keyColumns: ["unit_id", "tag_id", "profile_id"],
	},
	{
		relation: "unit_structure_application_judgment_timestamps",
		table: "unit_structure_application_judgment",
		keyColumns: ["unit_id", "structure_id", "profile_id"],
	},
	{
		relation: "realm_tag_judgment_timestamps",
		table: "realm_tag_judgment",
		keyColumns: ["realm_id", "unit_id", "tag_id", "profile_id"],
	},
] as const satisfies readonly TimestampVerificationSpec[];

const AggregateVerificationSpecs = [
	{
		relation: "unit_tag_judgment_stat",
		keyColumns: ["unit_id", "tag_id"],
		actualTable: "unit_tag_judgment_stat",
		actualColumns: [
			"score",
			"vote_count",
			"spoiler_vote_count",
			"spoiler_none_count",
			"spoiler_minor_count",
			"spoiler_major_count",
		],
		metricCount: 6,
		accumulatorLength: 8,
		presenceIndexes: [1, 2],
		eligibilityIndex: 7,
		sources: [
			{
				table: "unit_effective_tag_vote",
				accumulatorSql: "array[source.value::bigint, 1, 0, 0, 0, 0, 0, 1]",
			},
			{
				table: "unit_tag_judgment",
				accumulatorSql: `array[0, 0,
					(source.spoiler_level is not null)::integer,
					(source.spoiler_level = 0)::integer,
					(source.spoiler_level = 1)::integer,
					(source.spoiler_level = 2)::integer, 0,
					case when exists (
						select 1 from public.unit_effective_tag eligibility
						where eligibility.unit_id = source.unit_id
							and eligibility.tag_id = source.tag_id
					) then 1 else 0 end]`,
			},
		],
	},
	{
		relation: "unit_structure_application_judgment_stat",
		keyColumns: ["unit_id", "structure_id"],
		actualTable: "unit_structure_application_judgment_stat",
		actualColumns: [
			"score",
			"vote_count",
			"spoiler_vote_count",
			"spoiler_none_count",
			"spoiler_minor_count",
			"spoiler_major_count",
		],
		metricCount: 6,
		accumulatorLength: 7,
		presenceIndexes: [6],
		sources: [
			{
				table: "unit_structure_application_judgment",
				accumulatorSql: `array[coalesce(source.fit_vote, 0),
				(source.fit_vote is not null)::integer,
				(source.spoiler_level is not null)::integer,
				(source.spoiler_level = 0)::integer,
				(source.spoiler_level = 1)::integer,
				(source.spoiler_level = 2)::integer, 1]`,
			},
		],
	},
	{
		relation: "realm_tag_judgment_stat",
		keyColumns: ["realm_id", "unit_id", "tag_id"],
		actualTable: "realm_tag_judgment_stat",
		actualColumns: [
			"score",
			"vote_count",
			"spoiler_vote_count",
			"spoiler_none_count",
			"spoiler_minor_count",
			"spoiler_major_count",
		],
		metricCount: 6,
		accumulatorLength: 7,
		presenceIndexes: [6],
		sources: [
			{
				table: "realm_tag_judgment",
				accumulatorSql: `array[coalesce(source.fit_vote, 0),
				(source.fit_vote is not null)::integer,
				(source.spoiler_level is not null)::integer,
				(source.spoiler_level = 0)::integer,
				(source.spoiler_level = 1)::integer,
				(source.spoiler_level = 2)::integer, 1]`,
			},
		],
	},
	{
		relation: "subject_association_judgment_stat",
		keyColumns: ["association_id"],
		actualTable: "subject_association_judgment_stat",
		actualColumns: [
			"spoiler_vote_count",
			"spoiler_none_count",
			"spoiler_minor_count",
			"spoiler_major_count",
		],
		metricCount: 4,
		accumulatorLength: 5,
		presenceIndexes: [4],
		sources: [
			{
				table: "subject_association_judgment",
				accumulatorSql: `array[1,
				(source.spoiler_level = 0)::integer,
				(source.spoiler_level = 1)::integer,
				(source.spoiler_level = 2)::integer, 1]`,
			},
		],
	},
] as const satisfies readonly AggregateVerificationSpec[];

function sha256(value: string): string {
	return createHash("sha256").update(value, "utf8").digest("hex");
}

export function extendVndbV11VerificationChecksum(
	previousChecksum: string,
	canonicalRows: readonly string[],
): string {
	checksumSchema.parse(previousChecksum);
	return canonicalRows.reduce(
		(checksum, row) => sha256(`${checksum}\u0000${row}`),
		previousChecksum,
	);
}

export function deriveVndbV11RelationProof(
	transitionEpoch: bigint,
	relation: VndbV11CutoverVerificationRelation,
	verifiedRowCount: bigint,
	checksum: string,
): string {
	if (transitionEpoch <= 0n || verifiedRowCount < 0n)
		throw new TypeError("Verification proof epoch/count must be nonnegative and epoch nonzero");
	checksumSchema.parse(checksum);
	return sha256(
		JSON.stringify([
			VndbV11CutoverVerificationContract,
			transitionEpoch.toString(),
			relation,
			verifiedRowCount.toString(),
			checksum,
		]),
	);
}

export function deriveVndbV11CutoverProof(
	transitionEpoch: bigint,
	completed: readonly CompletedVndbV11RelationProof[],
): string {
	if (transitionEpoch <= 0n) throw new TypeError("Verification proof epoch must be positive");
	if (completed.length !== VndbV11CutoverVerificationRelationValues.length)
		throw new Error("A cutover proof requires every bounded verification relation");
	const byRelation = new Map(completed.map((proof) => [proof.relation, proof]));
	if (byRelation.size !== completed.length)
		throw new Error("Cutover proof relations must be unique");
	const canonical = VndbV11CutoverVerificationRelationValues.map((relation) => {
		const proof = byRelation.get(relation);
		if (!proof) throw new Error(`Missing bounded verification proof for ${relation}`);
		if (
			deriveVndbV11RelationProof(
				transitionEpoch,
				relation,
				proof.verifiedRowCount,
				proof.checksum,
			) !== proof.relationProof
		)
			throw new Error(`Invalid bounded verification relation proof for ${relation}`);
		return [relation, proof.verifiedRowCount.toString(), proof.checksum, proof.relationProof];
	});
	return sha256(
		JSON.stringify([VndbV11CutoverVerificationContract, transitionEpoch.toString(), canonical]),
	);
}

function quoteIdentifier(identifier: string): string {
	if (!/^[a-z][a-z0-9_]*$/.test(identifier))
		throw new TypeError(`Unsafe PostgreSQL identifier: ${identifier}`);
	return `"${identifier}"`;
}

function qualifiedColumns(alias: string, columns: readonly string[]): string[] {
	const quotedAlias = quoteIdentifier(alias);
	return columns.map((column) => `${quotedAlias}.${quoteIdentifier(column)}`);
}

function keysetPredicate(alias: string, columns: readonly string[], hasCursor: boolean): string {
	if (!hasCursor) return "";
	const qualified = qualifiedColumns(alias, columns);
	return `where (${qualified.join(", ")}) > (${columns
		.map((_, index) => `$${index + 2}::uuid`)
		.join(", ")})`;
}

export function buildVndbV11AggregateVerificationBatchSql(
	spec: AggregateVerificationSpec,
	hasCursor: boolean,
): string {
	const cursorKeyParameters = spec.keyColumns.map((_, index) => `$${index + 2}::uuid`);
	const phaseParameter = `$${spec.keyColumns.length + 2}::smallint`;
	const profileParameter = `$${spec.keyColumns.length + 3}::uuid`;
	const branchPredicate = (phase: number, profileSql: string) => {
		if (!hasCursor) return "";
		return `where (${qualifiedColumns("source", spec.keyColumns).join(", ")},
			${phase}::smallint, ${profileSql}) >
			(${cursorKeyParameters.join(", ")}, ${phaseParameter}, ${profileParameter})`;
	};
	const sourceStreams = spec.sources.map((source, phase) => {
		const profileSql = source.profileSql ?? "source.profile_id";
		return `(
			select ${qualifiedColumns("source", spec.keyColumns).join(", ")},
				${phase}::smallint as source_phase, ${profileSql} as profile_id,
				(${source.accumulatorSql})::text[] as delta,
				null::text[] as actual
			from public.${quoteIdentifier(source.table)} source
			${branchPredicate(phase, profileSql)}
			order by ${qualifiedColumns("source", spec.keyColumns).join(", ")}, ${profileSql}
			limit $1
		)`;
	});
	const actualPhase = spec.sources.length;
	const actualPredicate = hasCursor
		? `where (${qualifiedColumns("source", spec.keyColumns).join(", ")},
			${actualPhase}::smallint, '00000000-0000-0000-0000-000000000000'::uuid) >
			(${cursorKeyParameters.join(", ")}, ${phaseParameter}, ${profileParameter})`
		: "";
	const actualStream = `(
		select ${qualifiedColumns("source", spec.keyColumns).join(", ")},
			${actualPhase}::smallint as source_phase,
			'00000000-0000-0000-0000-000000000000'::uuid as profile_id,
			array_fill(0::bigint, array[${spec.accumulatorLength}])::text[] as delta,
			array[${spec.actualColumns
				.map((column) => `source.${quoteIdentifier(column)}::text`)
				.join(", ")}] as actual
		from public.${quoteIdentifier(spec.actualTable)} source
		${actualPredicate}
		order by ${qualifiedColumns("source", spec.keyColumns).join(", ")}
		limit $1
	)`;
	return `with fact_stream as materialized (
		${[...sourceStreams, actualStream].join("\n\t\tunion all\n\t\t")}
	)
	select array[${qualifiedColumns("fact_stream", spec.keyColumns)
		.map((column) => `${column}::text`)
		.join(", ")}] as "logicalKey",
		fact_stream.source_phase as phase,
		array[${qualifiedColumns("fact_stream", spec.keyColumns)
			.map((column) => `${column}::text`)
			.join(", ")}, fact_stream.source_phase::text,
			fact_stream.profile_id::text] as cursor,
		fact_stream.delta,
		fact_stream.actual
	from fact_stream
	order by ${qualifiedColumns("fact_stream", spec.keyColumns).join(", ")},
		fact_stream.source_phase, fact_stream.profile_id
	limit $1`;
}

async function readAggregateVerificationBatch(
	client: Client,
	spec: AggregateVerificationSpec,
	batchSize: number,
	state: CheckpointState,
): Promise<VerificationBatchResult> {
	const expectedCursorLength = spec.keyColumns.length + 2;
	if (state.cursor.length !== 0 && state.cursor.length !== expectedCursorLength)
		throw new Error(`Invalid persisted cursor for ${spec.relation}`);
	if (
		(state.accumulatorKey.length === 0) !== (state.accumulator.length === 0) ||
		(state.accumulatorKey.length !== 0 &&
			(state.accumulatorKey.length !== spec.keyColumns.length ||
				state.accumulator.length !== spec.accumulatorLength))
	)
		throw new Error(`Invalid persisted aggregate accumulator for ${spec.relation}`);
	const result = await client.query(
		buildVndbV11AggregateVerificationBatchSql(spec, state.cursor.length > 0),
		[batchSize, ...state.cursor],
	);
	const rowSchema = z
		.object({
			actual: z.array(bigintStringSchema).length(spec.actualColumns.length).nullable(),
			cursor: z.array(z.string()).length(expectedCursorLength),
			delta: z.array(bigintStringSchema).length(spec.accumulatorLength),
			logicalKey: z.array(uuidStringSchema).length(spec.keyColumns.length),
			phase: z.number().int().min(0).max(spec.sources.length),
		})
		.strict();
	const rows = z.array(rowSchema).max(batchSize).parse(result.rows);
	let accumulatorKey = [...state.accumulatorKey];
	let accumulator = state.accumulator.map(BigInt);
	const canonicalRows: string[] = [];
	const expectedPresent = () =>
		spec.presenceIndexes.some((index) => (accumulator[index] ?? 0n) > 0n) &&
		(spec.eligibilityIndex === undefined || (accumulator[spec.eligibilityIndex] ?? 0n) > 0n);
	const closeWithoutActual = () => {
		if (!accumulatorKey.length) return;
		if (expectedPresent())
			throw new Error(
				`Aggregate parity failed for ${spec.relation} at ${accumulatorKey.join("/")}: source row has no summary`,
			);
		canonicalRows.push(JSON.stringify([spec.relation, accumulatorKey, null]));
		accumulatorKey = [];
		accumulator = [];
	};
	for (const row of rows) {
		if (
			accumulatorKey.length > 0 &&
			JSON.stringify(accumulatorKey) !== JSON.stringify(row.logicalKey)
		)
			closeWithoutActual();
		if (accumulatorKey.length === 0) {
			accumulatorKey = [...row.logicalKey];
			accumulator = Array.from({ length: spec.accumulatorLength }, () => 0n);
		}
		accumulator = accumulator.map((value, index) => value + BigInt(row.delta[index] ?? "0"));
		if (row.actual) {
			const hasExpectedRow = expectedPresent();
			const expected = accumulator.slice(0, spec.metricCount).map(String);
			if (!hasExpectedRow || expected.some((value, index) => value !== row.actual?.[index]))
				throw new Error(
					`Aggregate parity failed for ${spec.relation} at ${row.logicalKey.join("/")}`,
				);
			canonicalRows.push(JSON.stringify([spec.relation, row.logicalKey, expected]));
			accumulatorKey = [];
			accumulator = [];
		}
	}
	if (!rows.length) closeWithoutActual();
	return {
		accumulator: accumulator.map(String),
		accumulatorKey,
		canonicalRows,
		cursor: rows.at(-1)?.cursor ?? state.cursor,
		scannedRows: rows.length,
	};
}

export function buildVndbV11TimestampVerificationBatchSql(
	spec: TimestampVerificationSpec,
	hasCursor: boolean,
): string {
	const qualifiedKeys = qualifiedColumns("source", spec.keyColumns);
	return `select
		array[${qualifiedKeys.map((column) => `${column}::text`).join(", ")}] as cursor,
		source.fit_vote as "fitVote",
		source.spoiler_level as "spoilerLevel",
		source.fit_updated_at::text as "fitUpdatedAt",
		source.spoiler_updated_at::text as "spoilerUpdatedAt"
	from public.${quoteIdentifier(spec.table)} source
	${keysetPredicate("source", spec.keyColumns, hasCursor)}
	order by ${qualifiedKeys.join(", ")}
	limit $1`;
}

export function buildVndbV11AggregateVerificationSqlManifest(
	hasCursor: boolean,
): readonly string[] {
	return AggregateVerificationSpecs.map((spec) =>
		buildVndbV11AggregateVerificationBatchSql(spec, hasCursor),
	);
}

export function buildVndbV11TimestampVerificationSqlManifest(
	hasCursor: boolean,
): readonly string[] {
	return TimestampVerificationSpecs.map((spec) =>
		buildVndbV11TimestampVerificationBatchSql(spec, hasCursor),
	);
}

async function readTimestampVerificationBatch(
	client: Client,
	spec: TimestampVerificationSpec,
	batchSize: number,
	state: CheckpointState,
): Promise<VerificationBatchResult> {
	if (state.cursor.length !== 0 && state.cursor.length !== spec.keyColumns.length)
		throw new Error(`Invalid persisted cursor for ${spec.relation}`);
	const result = await client.query(
		buildVndbV11TimestampVerificationBatchSql(spec, state.cursor.length > 0),
		[batchSize, ...state.cursor],
	);
	const rowSchema = z
		.object({
			cursor: z.array(uuidStringSchema).length(spec.keyColumns.length),
			fitUpdatedAt: z.string().min(1).nullable(),
			fitVote: z.number().int().nullable(),
			spoilerLevel: z.number().int().nullable(),
			spoilerUpdatedAt: z.string().min(1).nullable(),
		})
		.strict();
	const rows = z.array(rowSchema).max(batchSize).parse(result.rows);
	const canonicalRows = rows.map((row) => {
		if (
			(row.fitVote === null) !== (row.fitUpdatedAt === null) ||
			(row.spoilerLevel === null) !== (row.spoilerUpdatedAt === null)
		)
			throw new Error(`Timestamp parity failed for ${spec.table} at ${row.cursor.join("/")}`);
		return JSON.stringify([
			spec.relation,
			row.cursor,
			row.fitVote,
			row.fitUpdatedAt,
			row.spoilerLevel,
			row.spoilerUpdatedAt,
		]);
	});
	return {
		accumulator: [],
		accumulatorKey: [],
		canonicalRows,
		cursor: rows.at(-1)?.cursor ?? state.cursor,
		scannedRows: rows.length,
	};
}

export function buildVndbV11PrimaryPathProjectionBatchSql(hasCursor: boolean): string {
	const cursor = hasCursor
		? `where (source.final_tag_id, 0::smallint, source.structure_id,
			source.projection_version) > ($2::uuid, $3::smallint, $4::uuid, $5::integer)`
		: "";
	const pointerCursor = hasCursor
		? `where (source.tag_id, 1::smallint, source.structure_id,
			source.structure_projection_version) >
			($2::uuid, $3::smallint, $4::uuid, $5::integer)`
		: "";
	return `with projection_stream as materialized (
		(
			select source.final_tag_id, 0::smallint as phase, source.structure_id,
				source.projection_version, structure.id is not null as current_generation,
				candidate.structure_id is not null as candidate_present,
				candidate.accepted, candidate.wilson_lower_bound::text as wilson,
				candidate.score::text as score, candidate.vote_count::text as vote_count,
				null::text[] as actual
			from public.unit_structure_end source
			left join public.unit_structure structure
				on structure.id = source.structure_id
				and structure.active_projection_version = source.projection_version
			left join public.unit_structure_primary_path_candidate candidate
				on candidate.structure_id = source.structure_id
				and candidate.projection_version = source.projection_version
			${cursor}
			order by source.final_tag_id, source.structure_id, source.projection_version
			limit $1
		)
		union all
		(
			select source.tag_id as final_tag_id, 1::smallint as phase,
				source.structure_id, source.structure_projection_version as projection_version,
				false as current_generation, false as candidate_present,
				null::boolean as accepted, null::text as wilson, null::text as score,
				null::text as vote_count,
				array[source.structure_id::text,
					source.structure_projection_version::text] as actual
			from public.tag_primary_display_path source
			${pointerCursor}
			order by source.tag_id
			limit $1
		)
	)
	select array[projection_stream.final_tag_id::text] as "logicalKey",
		array[projection_stream.final_tag_id::text, projection_stream.phase::text,
			projection_stream.structure_id::text,
			projection_stream.projection_version::text] as cursor,
		projection_stream.phase, projection_stream.structure_id::text as "structureId",
		projection_stream.projection_version as "projectionVersion",
		projection_stream.current_generation as "currentGeneration",
		projection_stream.candidate_present as "candidatePresent",
		projection_stream.accepted, projection_stream.wilson,
		projection_stream.score, projection_stream.vote_count as "voteCount",
		projection_stream.actual
	from projection_stream
	order by projection_stream.final_tag_id, projection_stream.phase,
		projection_stream.structure_id, projection_stream.projection_version
	limit $1`;
}

async function readPrimaryPathProjectionBatch(
	client: Client,
	batchSize: number,
	state: CheckpointState,
): Promise<VerificationBatchResult> {
	if (state.cursor.length !== 0 && state.cursor.length !== 4)
		throw new Error("Invalid persisted cursor for unit_structure_primary_path_projection");
	const result = await client.query(
		buildVndbV11PrimaryPathProjectionBatchSql(state.cursor.length > 0),
		[batchSize, ...state.cursor],
	);
	const rows = z
		.array(
			z
				.object({
					accepted: z.boolean().nullable(),
					actual: z.tuple([uuidStringSchema, z.string().regex(/^\d+$/)]).nullable(),
					candidatePresent: z.boolean(),
					currentGeneration: z.boolean(),
					cursor: z.array(z.string()).length(4),
					logicalKey: z.array(uuidStringSchema).length(1),
					phase: z.number().int().min(0).max(1),
					projectionVersion: z.number().int().positive(),
					score: bigintStringSchema.nullable(),
					structureId: uuidStringSchema,
					voteCount: bigintStringSchema.nullable(),
					wilson: z.string().nullable(),
				})
				.strict(),
		)
		.max(batchSize)
		.parse(result.rows);
	let accumulatorKey = [...state.accumulatorKey];
	let winner = [...state.accumulator];
	const canonicalRows: string[] = [];
	const closeAbsentPointer = () => {
		if (!accumulatorKey.length) return;
		if (winner.length)
			throw new Error(`Primary Path projection parity failed for Tag ${accumulatorKey[0]}`);
		canonicalRows.push(
			JSON.stringify([VndbV11PrimaryPathProjectionProofRelation, accumulatorKey, null]),
		);
		accumulatorKey = [];
	};
	for (const row of rows) {
		if (accumulatorKey.length && JSON.stringify(accumulatorKey) !== JSON.stringify(row.logicalKey))
			closeAbsentPointer();
		if (!accumulatorKey.length) accumulatorKey = [...row.logicalKey];
		if (row.phase === 0) {
			if (row.candidatePresent && !row.currentGeneration)
				throw new Error(`Inactive primary Path candidate for Structure ${row.structureId}`);
			if (row.currentGeneration && !row.candidatePresent)
				throw new Error(`Missing current primary Path candidate for Structure ${row.structureId}`);
			if (row.currentGeneration && row.accepted) {
				if (row.wilson === null || row.score === null || row.voteCount === null)
					throw new Error(`Incomplete primary Path candidate for Structure ${row.structureId}`);
				const contender = [
					row.structureId,
					String(row.projectionVersion),
					row.wilson,
					row.score,
					row.voteCount,
				];
				const contenderWins =
					!winner.length ||
					Number(contender[2]) > Number(winner[2]) ||
					(Number(contender[2]) === Number(winner[2]) &&
						(BigInt(contender[3] ?? "0") > BigInt(winner[3] ?? "0") ||
							(BigInt(contender[3] ?? "0") === BigInt(winner[3] ?? "0") &&
								(BigInt(contender[4] ?? "0") > BigInt(winner[4] ?? "0") ||
									(BigInt(contender[4] ?? "0") === BigInt(winner[4] ?? "0") &&
										(row.structureId < (winner[0] ?? "") ||
											(row.structureId === winner[0] &&
												row.projectionVersion < Number(winner[1]))))))));
				if (contenderWins) winner = contender;
			}
		} else {
			const expected = winner.length ? [winner[0] ?? "", winner[1] ?? ""] : null;
			if (JSON.stringify(row.actual) !== JSON.stringify(expected))
				throw new Error(`Primary Path projection parity failed for Tag ${row.logicalKey[0]}`);
			canonicalRows.push(
				JSON.stringify([VndbV11PrimaryPathProjectionProofRelation, row.logicalKey, expected]),
			);
			accumulatorKey = [];
			winner = [];
		}
	}
	if (!rows.length) closeAbsentPointer();
	return {
		accumulator: winner,
		accumulatorKey,
		canonicalRows,
		cursor: rows.at(-1)?.cursor ?? state.cursor,
		scannedRows: rows.length,
	};
}

function wilsonLowerBoundSql(score: string, voteCount: string): string {
	return `case when coalesce(${voteCount}, 0) = 0 then 0::double precision else (
		(
			(
				((${voteCount}::numeric + ${score}::numeric) / (2 * ${voteCount}::numeric))
				+ (1.96 * 1.96) / (2 * ${voteCount}::numeric)
				- 1.96 * sqrt((
					(((${voteCount}::numeric + ${score}::numeric) / (2 * ${voteCount}::numeric))
					* (1 - ((${voteCount}::numeric + ${score}::numeric) / (2 * ${voteCount}::numeric)))
					+ (1.96 * 1.96) / (4 * ${voteCount}::numeric)) / ${voteCount}::numeric
				))
			) / (1 + (1.96 * 1.96) / ${voteCount}::numeric)
		)::double precision
	end`;
}

export function buildVndbV11PrimaryPathBackfillSourceSql(hasCursor: boolean): string {
	return `select structure.id::text as "structureId",
		structure.active_projection_version as "projectionVersion",
		structure.member_unit_ids[cardinality(structure.member_unit_ids)]::text as "finalTagId"
	from public.unit_structure structure
	${hasCursor ? "where structure.id > $2::uuid" : ""}
	order by structure.id
	limit $1`;
}

async function readPrimaryPathBackfillBatch(
	client: Client,
	batchSize: number,
	state: CheckpointState,
): Promise<VerificationBatchResult> {
	if (state.cursor.length !== 0 && state.cursor.length !== 1)
		throw new Error("Invalid persisted cursor for unit_structure_primary_path_backfill");
	const expectedWilson = wilsonLowerBoundSql("vote_stat.score", "vote_stat.vote_count");
	const proofResult = await client.query(
		`with batch as materialized (
			${buildVndbV11PrimaryPathBackfillSourceSql(state.cursor.length > 0)}
		)
		select array[batch."structureId"] as cursor,
			array[
				batch."projectionVersion"::text, batch."finalTagId",
				batch."finalTagId",
				coalesce(vote_stat.score > 0 and vote_stat.vote_count > 0, false)::text,
				(${expectedWilson})::text,
				coalesce(vote_stat.score, 0)::text,
				coalesce(vote_stat.vote_count, 0)::text
			] as expected,
			case when candidate.structure_id is null or structure_end.structure_id is null
				then null else array[
					candidate.projection_version::text, structure_end.final_tag_id::text,
					candidate.final_tag_id::text,
					candidate.accepted::text, candidate.wilson_lower_bound::text,
					candidate.score::text, candidate.vote_count::text
				] end as actual
		from batch
		left join public.unit_structure_vote_stat vote_stat
			on vote_stat.structure_id = batch."structureId"::uuid
		left join public.unit_structure_end structure_end
			on structure_end.structure_id = batch."structureId"::uuid
			and structure_end.projection_version = batch."projectionVersion"
		left join public.unit_structure_primary_path_candidate candidate
			on candidate.structure_id = batch."structureId"::uuid
			and candidate.projection_version = batch."projectionVersion"
		order by batch."structureId"::uuid`,
		[batchSize, ...state.cursor],
	);
	const proofRows = z
		.array(
			z
				.object({
					actual: z.array(z.string()).length(7).nullable(),
					cursor: z.array(uuidStringSchema).length(1),
					expected: z.array(z.string()).length(7),
				})
				.strict(),
		)
		.max(batchSize)
		.parse(proofResult.rows);
	const canonicalRows = proofRows.map((row) => {
		if (JSON.stringify(row.actual) !== JSON.stringify(row.expected))
			throw new Error(`Primary Path backfill parity failed for Structure ${row.cursor[0]}`);
		return JSON.stringify(["unit_structure_primary_path_backfill", row.cursor, row.expected]);
	});
	return {
		accumulator: [],
		accumulatorKey: [],
		canonicalRows,
		cursor: proofRows.at(-1)?.cursor ?? state.cursor,
		scannedRows: proofRows.length,
	};
}

const VerificationRelations: readonly VerificationRelation[] = [
	{
		name: "unit_structure_primary_path_backfill",
		keyColumns: ["structure_id"],
		readBatch: readPrimaryPathBackfillBatch,
	},
	{
		name: VndbV11PrimaryPathProjectionProofRelation,
		keyColumns: ["final_tag_id"],
		readBatch: readPrimaryPathProjectionBatch,
	},
	...TimestampVerificationSpecs.map(
		(spec): VerificationRelation => ({
			name: spec.relation,
			keyColumns: spec.keyColumns,
			readBatch: (client, batchSize, state) =>
				readTimestampVerificationBatch(client, spec, batchSize, state),
		}),
	),
	...AggregateVerificationSpecs.map(
		(spec): VerificationRelation => ({
			name: spec.relation,
			keyColumns: spec.keyColumns,
			readBatch: (client, batchSize, state) =>
				readAggregateVerificationBatch(client, spec, batchSize, state),
		}),
	),
];

interface CheckpointState {
	readonly accumulator: readonly string[];
	readonly accumulatorKey: readonly string[];
	readonly checksum: string;
	readonly completedAt: string | null;
	readonly cursor: readonly string[];
	readonly relationProof: string | null;
	readonly scannedRowCount: bigint;
	readonly verifiedRowCount: bigint;
}

interface BatchOutcome extends CheckpointState {
	readonly completed: boolean;
	readonly processed: number;
}

async function readPausedTransitionEpoch(client: Client, forShare = false): Promise<bigint> {
	const result = await client.query(
		`select control.transition_epoch::text as epoch,
			coalesce(transition.state = 'paused', false) as "auditPaused",
			coalesce((
				select count(*) = control.transition_epoch + 1
					and min(history.transition_epoch) = 0
					and max(history.transition_epoch) = control.transition_epoch
				from public.${CutoverTransitionTable} history
				where history.transition_epoch <= control.transition_epoch
			), false) as "historyComplete"
		from public.${CutoverControlTable} control
		left join public.${CutoverTransitionTable} transition
			on transition.transition_epoch = control.transition_epoch
		where control.id = 1 and control.state = 'paused'
		${forShare ? "for share of control" : ""}`,
	);
	const rows = z.array(pausedEpochRowSchema).max(1).parse(result.rows);
	const row = rows[0];
	if (!row || !row.auditPaused || !row.historyComplete)
		throw new Error(
			"Bounded vndb-v11 verification requires the singleton and append-only audit to agree on one paused transition epoch",
		);
	const epoch = BigInt(row.epoch);
	if (epoch <= 0n) throw new Error("Paused vndb-v11 transition epoch must be positive");
	return epoch;
}

async function lockExactPausedEpoch(client: Client, expectedEpoch: bigint): Promise<void> {
	const observed = await readPausedTransitionEpoch(client, true);
	if (observed !== expectedEpoch)
		throw new Error(
			`Paused vndb-v11 transition epoch changed from ${expectedEpoch} to ${observed}; the stale verification cannot advance`,
		);
}

async function readOrCreateCheckpoint(
	client: Client,
	transitionEpoch: bigint,
	relation: VerificationRelation,
): Promise<CheckpointState> {
	await client.query(
		`insert into public.${VndbV11CutoverVerificationCheckpointTable} (
			transition_epoch, relation, verification_contract
		) values ($1, $2, $3)
		on conflict (transition_epoch, relation) do nothing
		returning relation`,
		[transitionEpoch.toString(), relation.name, VndbV11CutoverVerificationContract],
	);
	const result = await client.query(
		`select relation, verification_contract as "verificationContract", cursor,
			accumulator_key as "accumulatorKey", accumulator,
			scanned_row_count::text as "scannedRowCount",
			verified_row_count::text as "verifiedRowCount", checksum,
			relation_proof as "relationProof", completed_at::text as "completedAt"
		from public.${VndbV11CutoverVerificationCheckpointTable}
		where transition_epoch = $1 and relation = $2
		for update`,
		[transitionEpoch.toString(), relation.name],
	);
	const row = z.array(checkpointRowSchema).length(1).parse(result.rows)[0];
	if (!row) throw new Error(`Missing verification checkpoint for ${relation.name}`);
	const state = {
		accumulator: row.accumulator,
		accumulatorKey: row.accumulatorKey,
		checksum: row.checksum,
		completedAt: row.completedAt,
		cursor: row.cursor,
		relationProof: row.relationProof,
		scannedRowCount: BigInt(row.scannedRowCount),
		verifiedRowCount: BigInt(row.verifiedRowCount),
	};
	if ((state.completedAt === null) !== (state.relationProof === null))
		throw new Error(`Persisted completion proof shape is invalid for ${relation.name}`);
	if (
		state.relationProof &&
		state.relationProof !==
			deriveVndbV11RelationProof(
				transitionEpoch,
				relation.name,
				state.verifiedRowCount,
				state.checksum,
			)
	)
		throw new Error(`Persisted relation proof is invalid for ${relation.name}`);
	return state;
}

async function runVerificationBatch(
	client: Client,
	transitionEpoch: bigint,
	relation: VerificationRelation,
	batchSize: number,
): Promise<BatchOutcome> {
	await client.query("begin");
	try {
		await client.query(
			`set local statement_timeout = '${MaximumVerificationStatementMilliseconds}ms'`,
		);
		await client.query("select pg_advisory_xact_lock_shared(71011001)");
		await lockExactPausedEpoch(client, transitionEpoch);
		const state = await readOrCreateCheckpoint(client, transitionEpoch, relation);
		if (state.relationProof) {
			await client.query("commit");
			return { ...state, completed: true, processed: 0 };
		}
		const batch = await relation.readBatch(client, batchSize, state);
		if (batch.scannedRows < 0 || batch.scannedRows > batchSize)
			throw new Error(`Bounded batch for ${relation.name} exceeded its physical-row limit`);
		const checksum = extendVndbV11VerificationChecksum(state.checksum, batch.canonicalRows);
		const verifiedRowCount = state.verifiedRowCount + BigInt(batch.canonicalRows.length);
		const scannedRowCount = state.scannedRowCount + BigInt(batch.scannedRows);
		if (batch.scannedRows === 0) {
			if (batch.accumulatorKey.length || batch.accumulator.length)
				throw new Error(
					`Bounded verification ended with a pending accumulator for ${relation.name}`,
				);
			const relationProof = deriveVndbV11RelationProof(
				transitionEpoch,
				relation.name,
				verifiedRowCount,
				checksum,
			);
			await client.query(
				`update public.${VndbV11CutoverVerificationCheckpointTable}
				set accumulator_key = $3::uuid[], accumulator = $4::text[],
					verified_row_count = $5, checksum = $6,
					relation_proof = $7, completed_at = clock_timestamp(),
					updated_at = clock_timestamp()
				where transition_epoch = $1 and relation = $2 and relation_proof is null`,
				[
					transitionEpoch.toString(),
					relation.name,
					[...batch.accumulatorKey],
					[...batch.accumulator],
					verifiedRowCount.toString(),
					checksum,
					relationProof,
				],
			);
			await client.query("commit");
			return {
				accumulator: batch.accumulator,
				accumulatorKey: batch.accumulatorKey,
				checksum,
				completed: true,
				completedAt: new Date().toISOString(),
				cursor: batch.cursor,
				processed: 0,
				relationProof,
				scannedRowCount,
				verifiedRowCount,
			};
		}
		if (!batch.cursor.length) throw new Error(`Bounded batch for ${relation.name} lost its cursor`);
		await client.query(
			`update public.${VndbV11CutoverVerificationCheckpointTable}
			set cursor = $3::text[], accumulator_key = $4::uuid[],
				accumulator = $5::text[], scanned_row_count = $6,
				verified_row_count = $7, checksum = $8,
				updated_at = clock_timestamp()
			where transition_epoch = $1 and relation = $2 and relation_proof is null`,
			[
				transitionEpoch.toString(),
				relation.name,
				[...batch.cursor],
				[...batch.accumulatorKey],
				[...batch.accumulator],
				scannedRowCount.toString(),
				verifiedRowCount.toString(),
				checksum,
			],
		);
		await client.query("commit");
		return {
			accumulator: batch.accumulator,
			accumulatorKey: batch.accumulatorKey,
			checksum,
			completed: false,
			completedAt: null,
			cursor: batch.cursor,
			processed: batch.scannedRows,
			relationProof: null,
			scannedRowCount,
			verifiedRowCount,
		};
	} catch (cause) {
		await client.query("rollback");
		throw cause;
	}
}

function postgresErrorCode(cause: unknown): string | undefined {
	if (typeof cause !== "object" || cause === null || !("code" in cause)) return undefined;
	return typeof cause.code === "string" ? cause.code : undefined;
}

export function vndbV11VerificationErrorIsRetryable(cause: unknown): boolean {
	return ["40001", "40P01", "55P03", "57014"].includes(postgresErrorCode(cause) ?? "");
}

export function adaptVndbV11VerificationBatchSize(
	batchSize: number,
	maximumBatchSize: number,
	elapsedMilliseconds: number,
): number {
	if (elapsedMilliseconds > TargetVerificationBatchMilliseconds)
		return Math.max(1, Math.floor(batchSize / 2));
	if (elapsedMilliseconds < TargetVerificationBatchMilliseconds / 2)
		return Math.min(maximumBatchSize, batchSize * 2);
	return batchSize;
}

async function runVerificationRelation(
	client: Client,
	transitionEpoch: bigint,
	relation: VerificationRelation,
	initialBatchSize: number,
	pauseForBackpressure: (client: Client) => Promise<void>,
): Promise<void> {
	let batchSize = initialBatchSize;
	while (true) {
		await pauseForBackpressure(client);
		const startedAt = performance.now();
		let outcome: BatchOutcome | undefined;
		for (let attempt = 0; attempt < MaximumVerificationRetries; attempt += 1) {
			try {
				outcome = await runVerificationBatch(client, transitionEpoch, relation, batchSize);
				break;
			} catch (cause) {
				if (
					!vndbV11VerificationErrorIsRetryable(cause) ||
					attempt + 1 === MaximumVerificationRetries
				)
					throw cause;
				if (postgresErrorCode(cause) === "57014")
					batchSize = Math.max(1, Math.floor(batchSize / 2));
				await new Promise((resolve) =>
					setTimeout(resolve, Math.min(1_000, 50 * 2 ** attempt + Math.random() * 50)),
				);
			}
		}
		if (!outcome) throw new Error(`Bounded verification made no attempt for ${relation.name}`);
		const elapsedMilliseconds = performance.now() - startedAt;
		console.info(
			`vndb-v11 bounded verification ${relation.name}: ${JSON.stringify({
				batchSize,
				completed: outcome.completed,
				cursor: outcome.cursor,
				elapsedMilliseconds: Math.round(elapsedMilliseconds),
				processed: outcome.processed,
				total: outcome.verifiedRowCount.toString(),
			})}`,
		);
		if (outcome.completed) return;
		batchSize = adaptVndbV11VerificationBatchSize(batchSize, initialBatchSize, elapsedMilliseconds);
	}
}

async function readCompletedRelationProofs(
	client: Client,
	transitionEpoch: bigint,
): Promise<readonly CompletedVndbV11RelationProof[]> {
	const result = await client.query(
		`select relation, verification_contract as "verificationContract", cursor,
			accumulator_key as "accumulatorKey", accumulator,
			scanned_row_count::text as "scannedRowCount",
			verified_row_count::text as "verifiedRowCount", checksum,
			relation_proof as "relationProof", completed_at::text as "completedAt"
		from public.${VndbV11CutoverVerificationCheckpointTable}
		where transition_epoch = $1
		order by relation`,
		[transitionEpoch.toString()],
	);
	const rows = z.array(completedCheckpointRowSchema).parse(result.rows);
	return rows.map((row) => ({
		checksum: row.checksum,
		relation: row.relation,
		relationProof: row.relationProof,
		verifiedRowCount: BigInt(row.verifiedRowCount),
	}));
}

async function finalizeCutoverProof(client: Client, transitionEpoch: bigint): Promise<string> {
	await client.query("begin");
	try {
		await client.query("select pg_advisory_xact_lock_shared(71011001)");
		await lockExactPausedEpoch(client, transitionEpoch);
		const completed = await readCompletedRelationProofs(client, transitionEpoch);
		const proof = deriveVndbV11CutoverProof(transitionEpoch, completed);
		const verifiedRowCount = completed.reduce(
			(total, relation) => total + relation.verifiedRowCount,
			0n,
		);
		await client.query(
			`insert into public.${VndbV11CutoverVerificationProofTable} (
				transition_epoch, verification_contract, relation_count,
				verified_row_count, proof, verified_by, completed_at
			) values ($1, $2, $3, $4, $5, current_user, clock_timestamp())
			on conflict (transition_epoch) do nothing`,
			[
				transitionEpoch.toString(),
				VndbV11CutoverVerificationContract,
				completed.length,
				verifiedRowCount.toString(),
				proof,
			],
		);
		const result = await client.query(
			`select verification_contract as "verificationContract",
				relation_count as "relationCount",
				verified_row_count::text as "verifiedRowCount", proof,
				verified_by as "verifiedBy", completed_at::text as "completedAt"
			from public.${VndbV11CutoverVerificationProofTable}
			where transition_epoch = $1`,
			[transitionEpoch.toString()],
		);
		const row = z
			.array(
				globalProofRowSchema.extend({
					verificationContract: z.literal(VndbV11CutoverVerificationContract),
				}),
			)
			.length(1)
			.parse(result.rows)[0];
		if (
			!row ||
			row.proof !== proof ||
			row.relationCount !== completed.length ||
			BigInt(row.verifiedRowCount) !== verifiedRowCount
		)
			throw new Error("Persisted vndb-v11 cutover proof disagrees with completed checkpoints");
		await client.query("commit");
		return proof;
	} catch (cause) {
		await client.query("rollback");
		throw cause;
	}
}

/** Fails closed unless the exact current paused epoch has one valid nine-part proof. */
export async function assertCurrentVndbV11CutoverVerificationProof(
	client: Client,
	expectedTransitionEpoch?: bigint,
): Promise<bigint> {
	const transitionEpoch = await readPausedTransitionEpoch(client);
	if (expectedTransitionEpoch !== undefined && transitionEpoch !== expectedTransitionEpoch)
		throw new Error(
			`Resume expected paused vndb-v11 epoch ${expectedTransitionEpoch}, observed ${transitionEpoch}`,
		);
	const completed = await readCompletedRelationProofs(client, transitionEpoch);
	const expectedProof = deriveVndbV11CutoverProof(transitionEpoch, completed);
	const expectedRowCount = completed.reduce(
		(total, relation) => total + relation.verifiedRowCount,
		0n,
	);
	const result = await client.query(
		`select verification_contract as "verificationContract",
			relation_count as "relationCount", verified_row_count::text as "verifiedRowCount",
			proof, verified_by as "verifiedBy", completed_at::text as "completedAt"
		from public.${VndbV11CutoverVerificationProofTable}
		where transition_epoch = $1`,
		[transitionEpoch.toString()],
	);
	const rows = z
		.array(
			globalProofRowSchema.extend({
				verificationContract: z.literal(VndbV11CutoverVerificationContract),
			}),
		)
		.max(1)
		.parse(result.rows);
	const proof = rows[0];
	if (
		!proof ||
		proof.proof !== expectedProof ||
		proof.relationCount !== VndbV11CutoverVerificationRelationValues.length ||
		BigInt(proof.verifiedRowCount) !== expectedRowCount
	)
		throw new Error(
			`Resume is blocked: paused vndb-v11 epoch ${transitionEpoch} lacks its complete exact-current-epoch bounded proof`,
		);
	return transitionEpoch;
}

async function drainVndbV11PrimaryPathDirtyKeys(
	client: Client,
	transitionEpoch: bigint,
	batchSize: number,
	pauseForBackpressure: (client: Client) => Promise<void>,
): Promise<void> {
	let consecutiveRetries = 0;
	while (true) {
		await pauseForBackpressure(client);
		await client.query("begin");
		try {
			await client.query("select pg_advisory_xact_lock(71011001)");
			await lockExactPausedEpoch(client, transitionEpoch);
			const result = await client.query(
				`with dirty_batch as materialized (
					select key_kind, key_id, revision
					from public.${PrimaryPathDirtyKeyTable}
					order by key_kind, key_id
					limit $1
					for update
				), refreshed as materialized (
					select dirty_batch.key_kind, dirty_batch.key_id, dirty_batch.revision,
						public.refresh_vndb_v11_primary_path_dirty_key(
							dirty_batch.key_kind, dirty_batch.key_id
						) as refreshed
					from dirty_batch
					order by dirty_batch.key_kind, dirty_batch.key_id
				), deleted as (
					delete from public.${PrimaryPathDirtyKeyTable} dirty
					using refreshed
					where dirty.key_kind = refreshed.key_kind
						and dirty.key_id = refreshed.key_id
						and dirty.revision = refreshed.revision
					returning dirty.key_id
				)
				select (select count(*)::text from dirty_batch) as "batchCount",
					(select count(*)::text from deleted) as "deletedCount"`,
				[batchSize],
			);
			const row = z
				.array(
					z
						.object({
							batchCount: z.string().regex(/^\d+$/),
							deletedCount: z.string().regex(/^\d+$/),
						})
						.strict(),
				)
				.length(1)
				.parse(result.rows)[0];
			if (!row) throw new Error("Primary Path dirty drain lost its bounded receipt");
			await client.query("commit");
			consecutiveRetries = 0;
			if (BigInt(row.batchCount) === 0n) return;
		} catch (cause) {
			await client.query("rollback");
			if (
				vndbV11VerificationErrorIsRetryable(cause) &&
				consecutiveRetries + 1 < MaximumVerificationRetries
			) {
				consecutiveRetries += 1;
				await new Promise((resolve) =>
					setTimeout(resolve, Math.min(1_000, 50 * 2 ** consecutiveRetries)),
				);
				continue;
			}
			throw cause;
		}
	}
}

/** Drains prepare-era deltas, then proves the two primary-Path relations read-only. */
export async function runVndbV11PrimaryPathVerification(
	client: Client,
	batchSize: number,
	pauseForBackpressure: (client: Client) => Promise<void>,
): Promise<bigint> {
	const transitionEpoch = await readPausedTransitionEpoch(client);
	await drainVndbV11PrimaryPathDirtyKeys(client, transitionEpoch, batchSize, pauseForBackpressure);
	for (const relation of VerificationRelations.slice(0, 2))
		await runVerificationRelation(
			client,
			transitionEpoch,
			relation,
			batchSize,
			pauseForBackpressure,
		);
	return transitionEpoch;
}

/** Online prepare-era materialization; synchronous dirty triggers cover concurrent deltas. */
export async function runVndbV11PrimaryPathOnlineBackfill(
	client: Client,
	initialBatchSize: number,
	pauseForBackpressure: (client: Client) => Promise<void>,
): Promise<void> {
	let batchSize = initialBatchSize;
	let consecutiveRetries = 0;
	while (true) {
		await pauseForBackpressure(client);
		const startedAt = performance.now();
		await client.query("begin");
		try {
			await client.query(
				`set local statement_timeout = '${MaximumVerificationStatementMilliseconds}ms'`,
			);
			await client.query("select pg_advisory_xact_lock_shared(71011001)");
			const stateResult = await client.query(
				`select progress.cursor::text as cursor,
					progress.processed_row_count::text as "processedRowCount",
					progress.completed_at::text as "completedAt"
				from public.${PrimaryPathBackfillProgressTable} progress
				join public.${CutoverControlTable} control
					on control.id = 1 and control.state = 'precontract_open'
				where progress.id
				for update of progress, control`,
			);
			const progress = z
				.array(
					z
						.object({
							completedAt: z.string().nullable(),
							cursor: uuidStringSchema.nullable(),
							processedRowCount: z.string().regex(/^\d+$/),
						})
						.strict(),
				)
				.length(1)
				.parse(stateResult.rows)[0];
			if (!progress)
				throw new Error("Online primary Path backfill requires precontract_open state");
			if (progress.completedAt) {
				await client.query("commit");
				return;
			}
			const batchResult = await client.query(
				`with structure_batch as materialized (
					select structure.id
					from public.unit_structure structure
					${progress.cursor ? "where structure.id > $2::uuid" : ""}
					order by structure.id
					limit $1
				)
				select structure_batch.id::text as "structureId",
					public.refresh_vndb_v11_primary_path_projection(
						structure_batch.id
					) as refreshed
				from structure_batch
				order by structure_batch.id`,
				progress.cursor ? [batchSize, progress.cursor] : [batchSize],
			);
			const rows = z
				.array(z.object({ structureId: uuidStringSchema, refreshed: z.unknown() }).strict())
				.max(batchSize)
				.parse(batchResult.rows);
			if (!rows.length) {
				await client.query(
					`update public.${PrimaryPathBackfillProgressTable}
					set completed_at = clock_timestamp(), updated_at = clock_timestamp()
					where id and completed_at is null`,
				);
				await client.query("commit");
				return;
			}
			const cursor = rows.at(-1)?.structureId;
			if (!cursor) throw new Error("Online primary Path batch lost its cursor");
			await client.query(
				`update public.${PrimaryPathBackfillProgressTable}
				set cursor = $1, processed_row_count = processed_row_count + $2,
					updated_at = clock_timestamp()
				where id and completed_at is null`,
				[cursor, rows.length],
			);
			await client.query("commit");
			consecutiveRetries = 0;
			batchSize = adaptVndbV11VerificationBatchSize(
				batchSize,
				initialBatchSize,
				performance.now() - startedAt,
			);
		} catch (cause) {
			await client.query("rollback");
			if (
				vndbV11VerificationErrorIsRetryable(cause) &&
				consecutiveRetries + 1 < MaximumVerificationRetries
			) {
				consecutiveRetries += 1;
				if (postgresErrorCode(cause) === "57014")
					batchSize = Math.max(1, Math.floor(batchSize / 2));
				await new Promise((resolve) =>
					setTimeout(resolve, Math.min(1_000, 50 * 2 ** consecutiveRetries)),
				);
				continue;
			}
			throw cause;
		}
	}
}

/** Fails closed unless the prepare-era materialization scan reached EOF. */
export async function assertVndbV11PrimaryPathOnlineBackfillComplete(
	client: Client,
): Promise<void> {
	const result = await client.query(
		`select progress.backfill_contract as "backfillContract",
			progress.completed_at::text as "completedAt"
		from public.${PrimaryPathBackfillProgressTable} progress
		where progress.id`,
	);
	const rows = z
		.array(
			z
				.object({
					backfillContract: z.literal(PrimaryPathOnlineBackfillContract),
					completedAt: z.string().min(1),
				})
				.strict(),
		)
		.max(1)
		.parse(result.rows);
	if (!rows[0])
		throw new Error(
			"VNDB v11 pause is blocked until the online primary Path backfill reaches its durable EOF marker",
		);
}

export async function runVndbV11CutoverVerification(
	client: Client,
	batchSize: number,
	pauseForBackpressure: (client: Client) => Promise<void>,
): Promise<{ readonly proof: string; readonly transitionEpoch: bigint }> {
	const transitionEpoch = await readPausedTransitionEpoch(client);
	await drainVndbV11PrimaryPathDirtyKeys(client, transitionEpoch, batchSize, pauseForBackpressure);
	for (const relation of VerificationRelations)
		await runVerificationRelation(
			client,
			transitionEpoch,
			relation,
			batchSize,
			pauseForBackpressure,
		);
	const proof = await finalizeCutoverProof(client, transitionEpoch);
	await assertCurrentVndbV11CutoverVerificationProof(client, transitionEpoch);
	return { proof, transitionEpoch };
}
