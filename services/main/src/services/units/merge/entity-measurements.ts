import { sql } from "drizzle-orm";

import { UnitMergeMeasurementConflict } from "../../api/governance/errors";
import type { DatabaseTransaction } from "../../database";
import { UnitMergePolicyV1 } from "./policy";

export const EntityMeasurementMergePhaseValues = [
	"entity_measurement_preflight",
	"entity_measurement_entities",
	"entity_measurement_contexts",
] as const;

export type EntityMeasurementMergePhase = (typeof EntityMeasurementMergePhaseValues)[number];

export function isEntityMeasurementMergePhase(phase: string): phase is EntityMeasurementMergePhase {
	return (
		phase === "entity_measurement_preflight" ||
		phase === "entity_measurement_entities" ||
		phase === "entity_measurement_contexts"
	);
}

export type EntityMeasurementMergeDirection = "entity_id" | "context_unit_id";

export type EntityMeasurementMergeInput = {
	readonly operationId: string;
	readonly sourceUnitId: string;
	readonly targetUnitId: string;
	readonly batchSize: number;
};

export type EntityMeasurementMergeBatchResult = {
	readonly processedRows: number;
	readonly done: boolean;
};

type MergePreflightRow = {
	readonly selfContext: boolean;
	readonly entityCollision: boolean;
	readonly targetContextualCount: number | string;
};

type MergePreflightCursorRow = {
	readonly cursorEntityId: string | null;
};

type MergePreflightScanRow = {
	readonly entityId: string;
	readonly selfContext: boolean;
	readonly differingCollision: boolean;
};

type BatchCompatibilityRow = {
	readonly selfContext: boolean;
	readonly differingCollision: boolean;
	readonly targetContextualCount: number | string;
};

type BatchLockUnitRow = { readonly unitId: string };

type BatchRow = { readonly processed: number | string; readonly remaining: boolean };

function requireBoundedBatchSize(batchSize: number): void {
	if (
		!Number.isSafeInteger(batchSize) ||
		batchSize < 1 ||
		batchSize > UnitMergePolicyV1.workerBatchSize
	)
		throw new RangeError(
			`Entity measurement merge batch size must be an integer from 1 through ${UnitMergePolicyV1.workerBatchSize}`,
		);
}

/**
 * Proves that both measurement identities can be rewritten without discarding
 * a sourced fact. The caller must hold the Unit merge advisory locks while it
 * uses this result to accept a merge.
 */
export async function requireEntityMeasurementsMergeable(
	tx: DatabaseTransaction,
	input: {
		readonly sourceUnitId: string;
		readonly targetUnitId: string;
		readonly sourceIsEntity: boolean;
	},
): Promise<void> {
	const result = await tx.execute<MergePreflightRow>(sql`
		select
			exists (
				select 1
				from entity_measurement as measurement
				where (
					measurement.entity_id = ${input.sourceUnitId}::uuid
					and measurement.context_unit_id in (
						${input.sourceUnitId}::uuid,
						${input.targetUnitId}::uuid
					)
				) or (
					measurement.entity_id = ${input.targetUnitId}::uuid
					and measurement.context_unit_id = ${input.sourceUnitId}::uuid
				)
				limit 1
			) as "selfContext",
			(${input.sourceIsEntity}::boolean and exists (
				select 1
				from entity_measurement as source
				join entity_measurement as target
					on target.entity_id = ${input.targetUnitId}::uuid
					and target.context_unit_id is not distinct from source.context_unit_id
				where source.entity_id = ${input.sourceUnitId}::uuid
					and row(
						source.height_millimetres,
						source.weight_grams,
						source.bust_millimetres,
						source.waist_millimetres,
						source.hips_millimetres,
						source.source_url,
						source.source_imported_at,
						source.source_provenance
					) is distinct from row(
						target.height_millimetres,
						target.weight_grams,
						target.bust_millimetres,
						target.waist_millimetres,
						target.hips_millimetres,
						target.source_url,
						target.source_imported_at,
						target.source_provenance
					)
				limit 1
			)) as "entityCollision",
			case when ${input.sourceIsEntity}::boolean then (
				select count(*)::integer
				from (
					select case
						when measurement.context_unit_id = ${input.sourceUnitId}::uuid
							then ${input.targetUnitId}::uuid
						else measurement.context_unit_id
					end as destination_context_unit_id
					from entity_measurement as measurement
					where measurement.entity_id in (
						${input.sourceUnitId}::uuid,
						${input.targetUnitId}::uuid
					)
						and measurement.context_unit_id is not null
					group by destination_context_unit_id
				) as contextual_destinations
			) else 0 end as "targetContextualCount"
	`);
	const row = result.rows[0];
	if (!row) throw new Error("Entity measurement merge preflight returned no row");
	if (row.selfContext) throw new UnitMergeMeasurementConflict({ reason: "self_context" });
	if (row.entityCollision)
		throw new UnitMergeMeasurementConflict({ reason: "differing_collision" });
	const contextualCount = Number(row.targetContextualCount);
	if (contextualCount > 8)
		throw new UnitMergeMeasurementConflict({
			reason: "context_limit",
			contextualCount,
		});
}

async function lockMeasurementPreflightUnits(
	tx: DatabaseTransaction,
	input: EntityMeasurementMergeInput,
): Promise<void> {
	await tx.execute(sql`
		select pg_advisory_xact_lock(
			hashtextextended('unit-merge:' || ids.unit_id::text, 0)
		)
		from (
			select unit_id
			from unnest(array[
				${input.sourceUnitId}::uuid,
				${input.targetUnitId}::uuid
			]) as affected(unit_id)
			order by unit_id
		) as ids
	`);
}

/**
 * Scans the unbounded context-reference side with a persistent keyset cursor.
 * Accepted operations freeze writes referring to either merge endpoint, so a
 * completed cursor is a durable watermark before any convergence phase starts.
 */
export async function processEntityMeasurementPreflightBatch(
	tx: DatabaseTransaction,
	input: EntityMeasurementMergeInput,
): Promise<EntityMeasurementMergeBatchResult> {
	requireBoundedBatchSize(input.batchSize);
	await lockMeasurementPreflightUnits(tx, input);
	await requireEntityMeasurementsMergeable(tx, {
		sourceUnitId: input.sourceUnitId,
		targetUnitId: input.targetUnitId,
		sourceIsEntity: true,
	});

	const cursorResult = await tx.execute<MergePreflightCursorRow>(sql`
		select measurement_preflight_cursor_entity_id as "cursorEntityId"
		from unit_merge_operation
		where id = ${input.operationId}::uuid
			and state = 'processing'
			and phase = 'entity_measurement_preflight'
	`);
	const cursorRow = cursorResult.rows[0];
	if (!cursorRow) throw new Error("Entity measurement preflight operation cursor is unavailable");
	const lookaheadLimit = input.batchSize + 1;
	const scanResult = await tx.execute<MergePreflightScanRow>(sql`
		select
			source.entity_id as "entityId",
			source.entity_id in (
				${input.sourceUnitId}::uuid,
				${input.targetUnitId}::uuid
			) as "selfContext",
			(target.entity_id is not null and row(
				source.height_millimetres,
				source.weight_grams,
				source.bust_millimetres,
				source.waist_millimetres,
				source.hips_millimetres,
				source.source_url,
				source.source_imported_at,
				source.source_provenance
			) is distinct from row(
				target.height_millimetres,
				target.weight_grams,
				target.bust_millimetres,
				target.waist_millimetres,
				target.hips_millimetres,
				target.source_url,
				target.source_imported_at,
				target.source_provenance
			)) as "differingCollision"
		from entity_measurement as source
		left join entity_measurement as target
			on target.entity_id = source.entity_id
			and target.context_unit_id = ${input.targetUnitId}::uuid
		where source.context_unit_id = ${input.sourceUnitId}::uuid
			and (
				${cursorRow.cursorEntityId}::uuid is null
				or source.entity_id > ${cursorRow.cursorEntityId}::uuid
			)
		order by source.entity_id
		limit ${lookaheadLimit}
	`);
	const batch = scanResult.rows.slice(0, input.batchSize);
	const conflict = batch.find((row) => row.selfContext || row.differingCollision);
	if (conflict?.selfContext) throw new UnitMergeMeasurementConflict({ reason: "self_context" });
	if (conflict?.differingCollision)
		throw new UnitMergeMeasurementConflict({ reason: "differing_collision" });

	const lastEntityId = batch.at(-1)?.entityId;
	if (lastEntityId) {
		const updateResult = await tx.execute<{ readonly id: string }>(sql`
			update unit_merge_operation
			set measurement_preflight_cursor_entity_id = ${lastEntityId}::uuid,
				updated_at = clock_timestamp()
			where id = ${input.operationId}::uuid
				and state = 'processing'
				and phase = 'entity_measurement_preflight'
			returning id
		`);
		if (!updateResult.rows[0])
			throw new Error("Entity measurement preflight cursor update lost its lease");
	}
	return {
		processedRows: batch.length,
		done: scanResult.rows.length <= input.batchSize,
	};
}

async function lockMeasurementMergeBatchUnits(
	tx: DatabaseTransaction,
	input: EntityMeasurementMergeInput,
	direction: EntityMeasurementMergeDirection,
): Promise<void> {
	const query =
		direction === "entity_id"
			? sql`
				select affected.unit_id as "unitId", pg_advisory_xact_lock(
					hashtextextended('unit-merge:' || affected.unit_id::text, 0)
				)
				from (
					select unit_id
					from (
						select ${input.sourceUnitId}::uuid as unit_id
						union all select ${input.targetUnitId}::uuid
						union all
						select batch.context_unit_id
						from (
							select context_unit_id
							from entity_measurement
							where entity_id = ${input.sourceUnitId}::uuid
							order by context_unit_id nulls first
							limit ${input.batchSize}
						) as batch
					) as candidates
					where unit_id is not null
					group by unit_id
					order by unit_id
				) as affected
			`
			: sql`
				select affected.unit_id as "unitId", pg_advisory_xact_lock(
					hashtextextended('unit-merge:' || affected.unit_id::text, 0)
				)
				from (
					select unit_id
					from (
						select ${input.sourceUnitId}::uuid as unit_id
						union all select ${input.targetUnitId}::uuid
						union all
						select batch.entity_id
						from (
							select entity_id
							from entity_measurement
							where context_unit_id = ${input.sourceUnitId}::uuid
							order by entity_id
							limit ${input.batchSize}
						) as batch
					) as candidates
					where unit_id is not null
					group by unit_id
					order by unit_id
				) as affected
			`;
	await tx.execute<BatchLockUnitRow>(query);
}

async function requireBatchCompatible(
	tx: DatabaseTransaction,
	input: EntityMeasurementMergeInput,
	direction: EntityMeasurementMergeDirection,
): Promise<void> {
	const query =
		direction === "entity_id"
			? sql`
				with batch as materialized (
					select source.*
					from entity_measurement as source
					where source.entity_id = ${input.sourceUnitId}::uuid
					order by source.context_unit_id nulls first
					limit ${input.batchSize}
					for update of source skip locked
				), collisions as materialized (
					select target.*
					from batch
					join entity_measurement as target
						on target.entity_id = ${input.targetUnitId}::uuid
						and target.context_unit_id is not distinct from batch.context_unit_id
					for update of target
				)
				select
					exists (
						select 1 from batch
						where context_unit_id = ${input.targetUnitId}::uuid
					) as "selfContext",
					exists (
						select 1
						from batch
						join collisions as target
							on target.context_unit_id is not distinct from batch.context_unit_id
						where row(
							batch.height_millimetres,
							batch.weight_grams,
							batch.bust_millimetres,
							batch.waist_millimetres,
							batch.hips_millimetres,
							batch.source_url,
							batch.source_imported_at,
							batch.source_provenance
						) is distinct from row(
							target.height_millimetres,
							target.weight_grams,
							target.bust_millimetres,
							target.waist_millimetres,
							target.hips_millimetres,
							target.source_url,
							target.source_imported_at,
							target.source_provenance
						)
					) as "differingCollision",
					(
						select count(*)::integer
						from (
							select case
								when measurement.context_unit_id = ${input.sourceUnitId}::uuid
									then ${input.targetUnitId}::uuid
								else measurement.context_unit_id
							end as destination_context_unit_id
							from entity_measurement as measurement
							where measurement.entity_id in (
								${input.sourceUnitId}::uuid,
								${input.targetUnitId}::uuid
							)
								and measurement.context_unit_id is not null
							group by destination_context_unit_id
						) as contextual_destinations
					) as "targetContextualCount"
			`
			: sql`
				with batch as materialized (
					select source.*
					from entity_measurement as source
					where source.context_unit_id = ${input.sourceUnitId}::uuid
					order by source.entity_id
					limit ${input.batchSize}
					for update of source skip locked
				), collisions as materialized (
					select target.*
					from batch
					join entity_measurement as target
						on target.entity_id = batch.entity_id
						and target.context_unit_id = ${input.targetUnitId}::uuid
					for update of target
				)
				select
					exists (
						select 1 from batch
						where entity_id = ${input.targetUnitId}::uuid
					) as "selfContext",
					exists (
						select 1
						from batch
						join collisions as target on target.entity_id = batch.entity_id
						where row(
							batch.height_millimetres,
							batch.weight_grams,
							batch.bust_millimetres,
							batch.waist_millimetres,
							batch.hips_millimetres,
							batch.source_url,
							batch.source_imported_at,
							batch.source_provenance
						) is distinct from row(
							target.height_millimetres,
							target.weight_grams,
							target.bust_millimetres,
							target.waist_millimetres,
							target.hips_millimetres,
							target.source_url,
							target.source_imported_at,
							target.source_provenance
						)
					) as "differingCollision",
					0::integer as "targetContextualCount"
			`;
	const result = await tx.execute<BatchCompatibilityRow>(query);
	const row = result.rows[0];
	if (!row) throw new Error("Entity measurement merge batch check returned no row");
	if (row.selfContext) throw new UnitMergeMeasurementConflict({ reason: "self_context" });
	if (row.differingCollision)
		throw new UnitMergeMeasurementConflict({ reason: "differing_collision" });
	const contextualCount = Number(row.targetContextualCount);
	if (contextualCount > 8)
		throw new UnitMergeMeasurementConflict({
			reason: "context_limit",
			contextualCount,
		});
}

function semanticDuplicateCondition(
	sourceAlias: "batch",
	targetAlias: "target",
): ReturnType<typeof sql> {
	return sql`row(
		${sql.identifier(sourceAlias)}.height_millimetres,
		${sql.identifier(sourceAlias)}.weight_grams,
		${sql.identifier(sourceAlias)}.bust_millimetres,
		${sql.identifier(sourceAlias)}.waist_millimetres,
		${sql.identifier(sourceAlias)}.hips_millimetres,
		${sql.identifier(sourceAlias)}.source_url,
		${sql.identifier(sourceAlias)}.source_imported_at,
		${sql.identifier(sourceAlias)}.source_provenance
	) is not distinct from row(
		${sql.identifier(targetAlias)}.height_millimetres,
		${sql.identifier(targetAlias)}.weight_grams,
		${sql.identifier(targetAlias)}.bust_millimetres,
		${sql.identifier(targetAlias)}.waist_millimetres,
		${sql.identifier(targetAlias)}.hips_millimetres,
		${sql.identifier(targetAlias)}.source_url,
		${sql.identifier(targetAlias)}.source_imported_at,
		${sql.identifier(targetAlias)}.source_provenance
	)`;
}

/** Moves one bounded batch after lossless preflight has accepted the merge. */
export async function processEntityMeasurementMergeBatch(
	tx: DatabaseTransaction,
	input: EntityMeasurementMergeInput,
	direction: EntityMeasurementMergeDirection,
): Promise<EntityMeasurementMergeBatchResult> {
	requireBoundedBatchSize(input.batchSize);
	await lockMeasurementMergeBatchUnits(tx, input, direction);
	await requireBatchCompatible(tx, input, direction);
	const sameMeasurement = semanticDuplicateCondition("batch", "target");
	const query =
		direction === "entity_id"
			? sql`
				with batch as materialized (
					select source.*
					from entity_measurement as source
					where source.entity_id = ${input.sourceUnitId}::uuid
					order by source.context_unit_id nulls first
					limit ${input.batchSize}
					for update of source skip locked
				), duplicates as materialized (
					select batch.entity_id, batch.context_unit_id
					from batch
					join entity_measurement as target
						on target.entity_id = ${input.targetUnitId}::uuid
						and target.context_unit_id is not distinct from batch.context_unit_id
					where ${sameMeasurement}
				), deleted_duplicates as (
					delete from entity_measurement as source
					using duplicates
					where source.entity_id = duplicates.entity_id
						and source.context_unit_id is not distinct from duplicates.context_unit_id
					returning 1
				), updated as (
					update entity_measurement as measurement
					set entity_id = ${input.targetUnitId}::uuid,
						updated_at = clock_timestamp()
					from batch
					where measurement.entity_id = batch.entity_id
						and measurement.context_unit_id is not distinct from batch.context_unit_id
						and not exists (
							select 1 from duplicates
							where duplicates.entity_id = batch.entity_id
								and duplicates.context_unit_id is not distinct from batch.context_unit_id
						)
					returning 1
				)
				select (
					cardinality(array(select 1 from deleted_duplicates)) +
					cardinality(array(select 1 from updated))
				)::integer as processed,
				exists (
					select 1 from entity_measurement
					where entity_id = ${input.sourceUnitId}::uuid
				) as remaining
			`
			: sql`
				with batch as materialized (
					select source.*
					from entity_measurement as source
					where source.context_unit_id = ${input.sourceUnitId}::uuid
					order by source.entity_id
					limit ${input.batchSize}
					for update of source skip locked
				), duplicates as materialized (
					select batch.entity_id, batch.context_unit_id
					from batch
					join entity_measurement as target
						on target.entity_id = batch.entity_id
						and target.context_unit_id = ${input.targetUnitId}::uuid
					where ${sameMeasurement}
				), deleted_duplicates as (
					delete from entity_measurement as source
					using duplicates
					where source.entity_id = duplicates.entity_id
						and source.context_unit_id = duplicates.context_unit_id
					returning 1
				), updated as (
					update entity_measurement as measurement
					set context_unit_id = ${input.targetUnitId}::uuid,
						updated_at = clock_timestamp()
					from batch
					where measurement.entity_id = batch.entity_id
						and measurement.context_unit_id = batch.context_unit_id
						and not exists (
							select 1 from duplicates
							where duplicates.entity_id = batch.entity_id
								and duplicates.context_unit_id = batch.context_unit_id
						)
					returning 1
				)
				select (
					cardinality(array(select 1 from deleted_duplicates)) +
					cardinality(array(select 1 from updated))
				)::integer as processed,
				exists (
					select 1 from entity_measurement
					where context_unit_id = ${input.sourceUnitId}::uuid
				) as remaining
			`;
	const result = await tx.execute<BatchRow>(query);
	const row = result.rows[0];
	return {
		processedRows: Number(row?.processed ?? 0),
		done: !(row?.remaining ?? false),
	};
}
