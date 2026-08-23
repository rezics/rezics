import { sql } from "drizzle-orm";

import type { DatabaseTransaction } from "../../database";
import { type UnitMergeOperationPhase, type UnitMergeGraphPlanV1 } from "../../database/schema";
import { processEntityMeasurementPreflightBatch } from "./entity-measurements";
import { processEntityMeasurementMergeBatch } from "./entity-measurements";

export type UnitMergePhaseInput = {
	readonly operationId: string;
	readonly sourceUnitId: string;
	readonly targetUnitId: string;
	readonly graphPlan: UnitMergeGraphPlanV1;
	readonly batchSize: number;
};

export type UnitMergePhaseResult = {
	readonly processedRows: number;
	readonly done: boolean;
};

export class UnitMergeEvidenceConflict extends Error {
	readonly _tag = "UnitMergeEvidenceConflict" as const;

	constructor(readonly reason: "subject_self_association") {
		super("Unit merge cannot preserve source evidence for a self Subject association");
	}
}

type BatchRow = { readonly processed: number | string; readonly remaining: boolean };

function presentBatch(row: BatchRow | undefined): UnitMergePhaseResult {
	return {
		processedRows: Number(row?.processed ?? 0),
		done: !(row?.remaining ?? false),
	};
}

async function runBatch(
	tx: DatabaseTransaction,
	query: ReturnType<typeof sql>,
): Promise<UnitMergePhaseResult> {
	const result = await tx.execute<BatchRow>(query);
	return presentBatch(result.rows[0]);
}

async function simpleReferenceBatch(
	tx: DatabaseTransaction,
	input: UnitMergePhaseInput,
	descriptor: {
		readonly table: "post" | "poll_option" | "content_structure_node" | "notification";
		readonly idColumn: "id";
		readonly unitColumn: "subject_unit_id" | "target_unit_id" | "content_unit_id";
	},
): Promise<UnitMergePhaseResult> {
	const table = sql.identifier(descriptor.table);
	const idColumn = sql.identifier(descriptor.idColumn);
	const unitColumn = sql.identifier(descriptor.unitColumn);
	return runBatch(
		tx,
		sql`
			with batch as materialized (
				select source.${idColumn} as id
				from ${table} as source
				where source.${unitColumn} = ${input.sourceUnitId}::uuid
				limit ${input.batchSize}
				for update skip locked
			), updated as (
				update ${table} as target
				set ${unitColumn} = ${input.targetUnitId}::uuid
				from batch
				where target.${idColumn} = batch.id
				returning 1
			)
			select cardinality(array(select 1 from updated)) as processed,
				exists(
					select 1 from ${table} as remaining
					where remaining.${unitColumn} = ${input.sourceUnitId}::uuid
				) as remaining
		`,
	);
}

async function variantGraphBatch(
	tx: DatabaseTransaction,
	input: UnitMergePhaseInput,
): Promise<UnitMergePhaseResult> {
	const action = input.graphPlan.action;
	if (action === "none") return { processedRows: 0, done: true };
	if (action === "detach_source") {
		const result = await tx.execute<{ id: string }>(sql`
			delete from unit_variant
			where variant_unit_id = ${input.sourceUnitId}::uuid
			returning variant_unit_id as id
		`);
		return { processedRows: result.rows.length, done: true };
	}
	const destinationMainUnitId = input.graphPlan.destinationMainUnitId;
	if (!destinationMainUnitId)
		throw new Error(`Unit merge graph action ${action} has no destination Main`);
	return runBatch(
		tx,
		sql`
			with detached_target as (
				delete from unit_variant
				where ${action} = 'promote_target_from_source'
					and variant_unit_id = ${input.targetUnitId}::uuid
					and main_unit_id = ${input.sourceUnitId}::uuid
				returning 1
			), batch as materialized (
				select variant_unit_id
				from unit_variant
				where main_unit_id = ${input.sourceUnitId}::uuid
					and variant_unit_id <> ${input.targetUnitId}::uuid
				order by created_at, variant_unit_id
				limit ${input.batchSize}
				for update skip locked
			), updated as (
				update unit_variant as relation
				set main_unit_id = ${destinationMainUnitId}::uuid,
					updated_at = clock_timestamp()
				from batch
				where relation.variant_unit_id = batch.variant_unit_id
				returning 1
			)
			select (
				cardinality(array(select 1 from detached_target)) +
				cardinality(array(select 1 from updated))
			)::int as processed,
			exists(
				select 1 from unit_variant
				where main_unit_id = ${input.sourceUnitId}::uuid
			) as remaining
		`,
	);
}

async function slugAddressBatch(
	tx: DatabaseTransaction,
	input: UnitMergePhaseInput,
): Promise<UnitMergePhaseResult> {
	return runBatch(
		tx,
		sql`
			with batch as materialized (
				select id, scope_unit_id
				from unit_slug_address
				where target_unit_id = ${input.sourceUnitId}::uuid
				limit ${input.batchSize}
				for update skip locked
			), deleted_self_scoped as (
				delete from unit_slug_address as address
				using batch
				where address.id = batch.id
					and batch.scope_unit_id = ${input.targetUnitId}::uuid
				returning 1
			), updated as (
				update unit_slug_address as address
				set target_unit_id = ${input.targetUnitId}::uuid,
					kind = case when address.kind = 'canonical' then 'redirect' else address.kind end,
					updated_at = clock_timestamp()
				from batch
				where address.id = batch.id
					and batch.scope_unit_id is distinct from ${input.targetUnitId}::uuid
				returning 1
			)
			select (
				cardinality(array(select 1 from deleted_self_scoped)) +
				cardinality(array(select 1 from updated))
			)::int as processed,
				exists(
					select 1 from unit_slug_address
					where target_unit_id = ${input.sourceUnitId}::uuid
				) as remaining
		`,
	);
}

async function slugScopeBatch(
	tx: DatabaseTransaction,
	input: UnitMergePhaseInput,
): Promise<UnitMergePhaseResult> {
	return runBatch(
		tx,
		sql`
			with batch as materialized (
				select id, slug, target_unit_id
				from unit_slug_address
				where scope_unit_id = ${input.sourceUnitId}::uuid
				order by slug
				limit ${input.batchSize}
				for update skip locked
			), deleted_conflicts as (
				delete from unit_slug_address as address
				using batch
				where address.id = batch.id
					and (
						batch.target_unit_id = ${input.targetUnitId}::uuid
						or exists (
							select 1 from unit_slug_address as canonical
							where canonical.scope_unit_id = ${input.targetUnitId}::uuid
								and canonical.slug = batch.slug
								and canonical.id <> batch.id
						)
					)
				returning 1
			), updated as (
				update unit_slug_address as address
				set scope_unit_id = ${input.targetUnitId}::uuid,
					updated_at = clock_timestamp()
				from batch
				where address.id = batch.id
					and batch.target_unit_id <> ${input.targetUnitId}::uuid
					and not exists (
						select 1 from unit_slug_address as canonical
						where canonical.scope_unit_id = ${input.targetUnitId}::uuid
							and canonical.slug = batch.slug
							and canonical.id <> batch.id
					)
				returning 1
			)
			select (
				cardinality(array(select 1 from deleted_conflicts)) +
				cardinality(array(select 1 from updated))
			)::int as processed,
			exists(
				select 1 from unit_slug_address
				where scope_unit_id = ${input.sourceUnitId}::uuid
			) as remaining
		`,
	);
}

async function aliasBatch(
	tx: DatabaseTransaction,
	input: UnitMergePhaseInput,
): Promise<UnitMergePhaseResult> {
	await tx.execute(sql`
		select pg_advisory_xact_lock(
			hashtextextended('unit-reference:alias:' || ${input.targetUnitId}::text, 0)
		)
	`);
	return runBatch(
		tx,
		sql`
			with batch as materialized (
				select id, language, normalized_term, withdrawn_at
				from unit_alias
				where unit_id = ${input.sourceUnitId}::uuid
				order by language, normalized_term
				limit ${input.batchSize}
				for update skip locked
			), duplicate_map as materialized (
				select batch.id as source_alias_id, canonical.id as target_alias_id
				from batch
				join unit_alias as canonical
					on canonical.unit_id = ${input.targetUnitId}::uuid
					and canonical.language is not distinct from batch.language
					and canonical.normalized_term = batch.normalized_term
			), duplicate_to_drain as materialized (
				select source_alias_id, target_alias_id
				from duplicate_map
				order by source_alias_id
				limit 1
			), vote_batch as materialized (
				select vote.alias_id, duplicate_to_drain.target_alias_id, vote.profile_id,
					vote.value, vote.created_at, vote.updated_at
				from duplicate_to_drain
				join unit_alias_vote as vote
					on vote.alias_id = duplicate_to_drain.source_alias_id
				order by vote.alias_id, vote.profile_id
				limit ${input.batchSize}
				for update of vote skip locked
			), copied_votes as (
				insert into unit_alias_vote (
					alias_id, profile_id, value, created_at, updated_at
				)
				select target_alias_id, profile_id, value, created_at, updated_at
				from vote_batch
				on conflict (alias_id, profile_id) do update
				set value = case
						when excluded.updated_at >= unit_alias_vote.updated_at then excluded.value
						else unit_alias_vote.value
					end,
					created_at = least(unit_alias_vote.created_at, excluded.created_at),
					updated_at = greatest(unit_alias_vote.updated_at, excluded.updated_at)
				returning 1
			), deleted_votes as (
				delete from unit_alias_vote as vote
				using vote_batch
				where vote.alias_id = vote_batch.alias_id
					and vote.profile_id = vote_batch.profile_id
				returning 1
			), deleted as (
				delete from unit_alias as alias
				using duplicate_map
				where alias.id = duplicate_map.source_alias_id
					and not exists (select 1 from vote_batch)
					and not exists (
						select 1 from unit_alias_vote
						where alias_id = duplicate_map.source_alias_id
					)
				returning 1
			), target_capacity as materialized (
				select greatest(
					128 - cardinality(array(
						select 1
						from unit_alias
						where unit_id = ${input.targetUnitId}::uuid
							and withdrawn_at is null
						limit 128
					)),
					0
				) as active_slots
			), movable as materialized (
				select batch.*,
					sum(case when batch.withdrawn_at is null then 1 else 0 end) over (
						order by batch.language, batch.normalized_term
					) as active_rank
				from batch
				where not exists (
					select 1 from duplicate_map
					where duplicate_map.source_alias_id = batch.id
				)
			), updated as (
				update unit_alias as alias
				set unit_id = ${input.targetUnitId}::uuid,
					withdrawn_at = case
						when movable.withdrawn_at is null
							and movable.active_rank > target_capacity.active_slots
							then clock_timestamp()
						else movable.withdrawn_at
					end,
					pinned = false,
					position = null,
					updated_at = clock_timestamp()
				from movable cross join target_capacity
				where alias.id = movable.id
					and not exists (select 1 from vote_batch)
				returning 1
			)
			select (
				cardinality(array(select 1 from deleted_votes)) +
				cardinality(array(select 1 from deleted)) +
				cardinality(array(select 1 from updated))
			)::int as processed,
			exists(
				select 1 from unit_alias where unit_id = ${input.sourceUnitId}::uuid
			) as remaining
		`,
	);
}

async function externalLinkBatch(
	tx: DatabaseTransaction,
	input: UnitMergePhaseInput,
): Promise<UnitMergePhaseResult> {
	await tx.execute(sql`
		select pg_advisory_xact_lock(
			hashtextextended('unit-reference:external_link:' || ${input.targetUnitId}::text, 0)
		)
	`);
	return runBatch(
		tx,
		sql`
			with batch as materialized (
				select id, source_entity_id, normalized_url_hash, withdrawn_at
				from unit_external_link
				where unit_id = ${input.sourceUnitId}::uuid
				order by source_entity_id, normalized_url_hash
				limit ${input.batchSize}
				for update skip locked
			), duplicate_map as materialized (
				select batch.id as source_link_id, canonical.id as target_link_id
				from batch
				join unit_external_link as canonical
					on canonical.unit_id = ${input.targetUnitId}::uuid
					and canonical.source_entity_id = batch.source_entity_id
					and canonical.normalized_url_hash = batch.normalized_url_hash
			), duplicate_to_drain as materialized (
				select source_link_id, target_link_id
				from duplicate_map
				order by source_link_id
				limit 1
			), vote_batch as materialized (
				select vote.external_link_id, duplicate_to_drain.target_link_id, vote.profile_id,
					vote.value, vote.created_at, vote.updated_at
				from duplicate_to_drain
				join unit_external_link_vote as vote
					on vote.external_link_id = duplicate_to_drain.source_link_id
				order by vote.external_link_id, vote.profile_id
				limit ${input.batchSize}
				for update of vote skip locked
			), requirement_batch as materialized (
				select requirement.id, duplicate_to_drain.source_link_id,
					duplicate_to_drain.target_link_id
				from duplicate_to_drain
				join software_requirement as requirement
					on requirement.source_external_link_id = duplicate_to_drain.source_link_id
				limit ${input.batchSize}
				for update of requirement skip locked
			), copied_votes as (
				insert into unit_external_link_vote (
					external_link_id, profile_id, value, created_at, updated_at
				)
				select target_link_id, profile_id, value, created_at, updated_at
				from vote_batch
				on conflict (external_link_id, profile_id) do update
				set value = case
						when excluded.updated_at >= unit_external_link_vote.updated_at then excluded.value
						else unit_external_link_vote.value
					end,
					created_at = least(unit_external_link_vote.created_at, excluded.created_at),
					updated_at = greatest(unit_external_link_vote.updated_at, excluded.updated_at)
				returning 1
			), deleted_votes as (
				delete from unit_external_link_vote as vote
				using vote_batch
				where vote.external_link_id = vote_batch.external_link_id
					and vote.profile_id = vote_batch.profile_id
				returning 1
			), rewired_requirements as (
				update software_requirement as requirement
				set source_external_link_id = requirement_batch.target_link_id,
					updated_at = clock_timestamp()
				from requirement_batch
				where requirement.id = requirement_batch.id
					and requirement.source_external_link_id = requirement_batch.source_link_id
				returning 1
			), deleted as (
				delete from unit_external_link as link
				using duplicate_map
				where link.id = duplicate_map.source_link_id
					and not exists (select 1 from vote_batch)
					and not exists (select 1 from requirement_batch)
					and not exists (
						select 1 from unit_external_link_vote
						where external_link_id = duplicate_map.source_link_id
					)
					and not exists (
						select 1 from software_requirement
						where source_external_link_id = duplicate_map.source_link_id
					)
				returning 1
			), target_capacity as materialized (
				select greatest(
					128 - cardinality(array(
						select 1
						from unit_external_link
						where unit_id = ${input.targetUnitId}::uuid
							and withdrawn_at is null
						limit 128
					)),
					0
				) as active_slots
			), movable as materialized (
				select batch.*,
					sum(case when batch.withdrawn_at is null then 1 else 0 end) over (
						order by batch.source_entity_id, batch.normalized_url_hash
					) as active_rank
				from batch
				where not exists (
					select 1 from duplicate_map
					where duplicate_map.source_link_id = batch.id
				)
			), updated as (
				update unit_external_link as link
				set unit_id = ${input.targetUnitId}::uuid,
					withdrawn_at = case
						when movable.withdrawn_at is null
							and movable.active_rank > target_capacity.active_slots
							then clock_timestamp()
						else movable.withdrawn_at
					end,
					pinned = false,
					position = null,
					updated_at = clock_timestamp()
				from movable cross join target_capacity
				where link.id = movable.id
					and not exists (select 1 from vote_batch)
					and not exists (select 1 from requirement_batch)
				returning 1
			)
			select (
				cardinality(array(select 1 from deleted_votes)) +
				cardinality(array(select 1 from rewired_requirements)) +
				cardinality(array(select 1 from deleted)) +
				cardinality(array(select 1 from updated))
			)::int as processed,
			exists(
				select 1 from unit_external_link
				where unit_id = ${input.sourceUnitId}::uuid
			) as remaining
		`,
	);
}

async function externalLinkSourceBatch(
	tx: DatabaseTransaction,
	input: UnitMergePhaseInput,
): Promise<UnitMergePhaseResult> {
	return runBatch(
		tx,
		sql`
			with batch as materialized (
				select id, unit_id, normalized_url_hash
				from unit_external_link
				where source_entity_id = ${input.sourceUnitId}::uuid
				limit ${input.batchSize}
				for update skip locked
			), duplicate_map as materialized (
				select batch.id as source_link_id, canonical.id as target_link_id
				from batch
				join unit_external_link as canonical
					on canonical.unit_id = batch.unit_id
					and canonical.source_entity_id = ${input.targetUnitId}::uuid
					and canonical.normalized_url_hash = batch.normalized_url_hash
			), duplicate_to_drain as materialized (
				select source_link_id, target_link_id
				from duplicate_map
				order by source_link_id
				limit 1
			), vote_batch as materialized (
				select vote.external_link_id, duplicate_to_drain.target_link_id, vote.profile_id,
					vote.value, vote.created_at, vote.updated_at
				from duplicate_to_drain
				join unit_external_link_vote as vote
					on vote.external_link_id = duplicate_to_drain.source_link_id
				order by vote.external_link_id, vote.profile_id
				limit ${input.batchSize}
				for update of vote skip locked
			), requirement_batch as materialized (
				select requirement.id, duplicate_to_drain.source_link_id,
					duplicate_to_drain.target_link_id
				from duplicate_to_drain
				join software_requirement as requirement
					on requirement.source_external_link_id = duplicate_to_drain.source_link_id
				limit ${input.batchSize}
				for update of requirement skip locked
			), copied_votes as (
				insert into unit_external_link_vote (
					external_link_id, profile_id, value, created_at, updated_at
				)
				select target_link_id, profile_id, value, created_at, updated_at
				from vote_batch
				on conflict (external_link_id, profile_id) do update
				set value = case
						when excluded.updated_at >= unit_external_link_vote.updated_at then excluded.value
						else unit_external_link_vote.value
					end,
					created_at = least(unit_external_link_vote.created_at, excluded.created_at),
					updated_at = greatest(unit_external_link_vote.updated_at, excluded.updated_at)
				returning 1
			), deleted_votes as (
				delete from unit_external_link_vote as vote
				using vote_batch
				where vote.external_link_id = vote_batch.external_link_id
					and vote.profile_id = vote_batch.profile_id
				returning 1
			), rewired_requirements as (
				update software_requirement as requirement
				set source_external_link_id = requirement_batch.target_link_id,
					updated_at = clock_timestamp()
				from requirement_batch
				where requirement.id = requirement_batch.id
					and requirement.source_external_link_id = requirement_batch.source_link_id
				returning 1
			), deleted as (
				delete from unit_external_link as link
				using duplicate_map
				where link.id = duplicate_map.source_link_id
					and not exists (select 1 from vote_batch)
					and not exists (select 1 from requirement_batch)
					and not exists (
						select 1 from unit_external_link_vote
						where external_link_id = duplicate_map.source_link_id
					)
					and not exists (
						select 1 from software_requirement
						where source_external_link_id = duplicate_map.source_link_id
					)
				returning 1
			), updated as (
				update unit_external_link as link
				set source_entity_id = ${input.targetUnitId}::uuid,
					updated_at = clock_timestamp()
				from batch
				where link.id = batch.id
					and not exists (select 1 from vote_batch)
					and not exists (select 1 from requirement_batch)
					and not exists (
						select 1 from duplicate_map
						where duplicate_map.source_link_id = batch.id
					)
				returning 1
			)
			select (
				cardinality(array(select 1 from deleted_votes)) +
				cardinality(array(select 1 from rewired_requirements)) +
				cardinality(array(select 1 from deleted)) +
				cardinality(array(select 1 from updated))
			)::int as processed,
			exists(
				select 1 from unit_external_link
				where source_entity_id = ${input.sourceUnitId}::uuid
			) as remaining
		`,
	);
}

async function softwareRequirementPlatformBatch(
	tx: DatabaseTransaction,
	input: UnitMergePhaseInput,
): Promise<UnitMergePhaseResult> {
	return runBatch(
		tx,
		sql`
			with batch as materialized (
				select id, software_id, tier
				from software_requirement
				where platform_entity_id = ${input.sourceUnitId}::uuid
				limit ${input.batchSize}
				for update skip locked
			), deleted_duplicates as (
				delete from software_requirement as requirement
				using batch
				where requirement.id = batch.id
					and exists (
						select 1 from software_requirement as canonical
						where canonical.software_id = batch.software_id
							and canonical.platform_entity_id = ${input.targetUnitId}::uuid
							and canonical.tier = batch.tier
							and canonical.id <> batch.id
					)
				returning 1
			), updated as (
				update software_requirement as requirement
				set platform_entity_id = ${input.targetUnitId}::uuid,
					updated_at = clock_timestamp()
				from batch
				where requirement.id = batch.id
					and not exists (
						select 1 from software_requirement as canonical
						where canonical.software_id = batch.software_id
							and canonical.platform_entity_id = ${input.targetUnitId}::uuid
							and canonical.tier = batch.tier
							and canonical.id <> batch.id
					)
				returning 1
			)
			select (
				cardinality(array(select 1 from deleted_duplicates)) +
				cardinality(array(select 1 from updated))
			)::int as processed,
			exists(
				select 1 from software_requirement
				where platform_entity_id = ${input.sourceUnitId}::uuid
			) as remaining
		`,
	);
}

async function softwareRequirementBatch(
	tx: DatabaseTransaction,
	input: UnitMergePhaseInput,
): Promise<UnitMergePhaseResult> {
	return runBatch(
		tx,
		sql`
			with batch as materialized (
				select id, platform_entity_id, tier
				from software_requirement
				where software_id = ${input.sourceUnitId}::uuid
				order by platform_entity_id, tier
				limit ${input.batchSize}
				for update skip locked
			), deleted_duplicates as (
				delete from software_requirement as requirement
				using batch
				where requirement.id = batch.id
					and exists (
						select 1 from software_requirement as canonical
						where canonical.software_id = ${input.targetUnitId}::uuid
							and canonical.platform_entity_id is not distinct from batch.platform_entity_id
							and canonical.tier = batch.tier
							and canonical.id <> batch.id
					)
				returning 1
			), updated as (
				update software_requirement as requirement
				set software_id = ${input.targetUnitId}::uuid,
					updated_at = clock_timestamp()
				from batch
				where requirement.id = batch.id
					and not exists (
						select 1 from software_requirement as canonical
						where canonical.software_id = ${input.targetUnitId}::uuid
							and canonical.platform_entity_id is not distinct from batch.platform_entity_id
							and canonical.tier = batch.tier
							and canonical.id <> batch.id
					)
				returning 1
			)
			select (
				cardinality(array(select 1 from deleted_duplicates)) +
				cardinality(array(select 1 from updated))
			)::int as processed,
			exists(
				select 1 from software_requirement
				where software_id = ${input.sourceUnitId}::uuid
			) as remaining
		`,
	);
}

async function reactionBatch(
	tx: DatabaseTransaction,
	input: UnitMergePhaseInput,
): Promise<UnitMergePhaseResult> {
	return runBatch(
		tx,
		sql`
			with batch as materialized (
				select id, profile_id, realm_id, reaction, created_at, updated_at
				from unit_reaction
				where unit_id = ${input.sourceUnitId}::uuid
				order by reaction, realm_id
				limit ${input.batchSize}
				for update skip locked
			), duplicate_map as materialized (
				select batch.id as source_id, canonical.id as target_id
				from batch
				join unit_reaction as canonical
					on canonical.profile_id = batch.profile_id
					and canonical.unit_id = ${input.targetUnitId}::uuid
					and canonical.realm_id is not distinct from batch.realm_id
			), refreshed as (
				update unit_reaction as canonical
				set reaction = batch.reaction,
					created_at = least(canonical.created_at, batch.created_at),
					updated_at = greatest(canonical.updated_at, batch.updated_at)
				from duplicate_map
				join batch on batch.id = duplicate_map.source_id
				where canonical.id = duplicate_map.target_id
					and batch.updated_at >= canonical.updated_at
				returning 1
			), deleted as (
				delete from unit_reaction as reaction
				using duplicate_map
				where reaction.id = duplicate_map.source_id
				returning 1
			), updated as (
				update unit_reaction as reaction
				set unit_id = ${input.targetUnitId}::uuid
				from batch
				where reaction.id = batch.id
					and not exists (
						select 1 from duplicate_map where duplicate_map.source_id = batch.id
					)
				returning 1
			)
			select (
				cardinality(array(select 1 from deleted)) +
				cardinality(array(select 1 from updated))
			)::int as processed,
			exists(
				select 1 from unit_reaction where unit_id = ${input.sourceUnitId}::uuid
			) as remaining
		`,
	);
}

async function shareBatch(
	tx: DatabaseTransaction,
	input: UnitMergePhaseInput,
): Promise<UnitMergePhaseResult> {
	return runBatch(
		tx,
		sql`
			with batch as materialized (
				select profile_id, created_at
				from unit_share
				where unit_id = ${input.sourceUnitId}::uuid
				order by created_at desc, profile_id
				limit ${input.batchSize}
				for update skip locked
			), copied as (
				insert into unit_share (profile_id, unit_id, created_at)
				select profile_id, ${input.targetUnitId}::uuid, created_at from batch
				on conflict (profile_id, unit_id) do update
				set created_at = least(unit_share.created_at, excluded.created_at)
				returning 1
			), deleted as (
				delete from unit_share as share
				using batch
				where share.profile_id = batch.profile_id
					and share.unit_id = ${input.sourceUnitId}::uuid
				returning 1
			)
			select cardinality(array(select 1 from deleted)) as processed,
				exists(
					select 1 from unit_share where unit_id = ${input.sourceUnitId}::uuid
				) as remaining
		`,
	);
}

async function followBatch(
	tx: DatabaseTransaction,
	input: UnitMergePhaseInput,
): Promise<UnitMergePhaseResult> {
	return runBatch(
		tx,
		sql`
			with batch as materialized (
				select follow.follower_profile_id, follow.position, follow.favorite,
					follow.created_at, follow.updated_at,
					preference.in_app as preference_in_app,
					preference.created_at as preference_created_at,
					preference.updated_at as preference_updated_at
				from unit_follow as follow
				left join unit_follow_notification_preference as preference
					on preference.follower_profile_id = follow.follower_profile_id
					and preference.unit_id = follow.unit_id
				where follow.unit_id = ${input.sourceUnitId}::uuid
				order by follow.created_at desc, follow.follower_profile_id
				limit ${input.batchSize}
				for update of follow skip locked
			), copied_follows as (
				insert into unit_follow (
					follower_profile_id, unit_id, position, favorite, created_at, updated_at
				)
				select follower_profile_id, ${input.targetUnitId}::uuid, position, favorite,
					created_at, updated_at
				from batch
				on conflict (follower_profile_id, unit_id) do update
				set favorite = unit_follow.favorite or excluded.favorite,
					created_at = least(unit_follow.created_at, excluded.created_at),
					updated_at = greatest(unit_follow.updated_at, excluded.updated_at)
				returning follower_profile_id
			), copied_preferences as (
				insert into unit_follow_notification_preference (
					follower_profile_id, unit_id, in_app, created_at, updated_at
				)
				select follower_profile_id, ${input.targetUnitId}::uuid, preference_in_app,
					preference_created_at, preference_updated_at
				from batch
				join copied_follows using (follower_profile_id)
				where preference_in_app is not null
				on conflict (follower_profile_id, unit_id) do update
				set in_app = unit_follow_notification_preference.in_app and excluded.in_app,
					created_at = least(
						unit_follow_notification_preference.created_at,
						excluded.created_at
					),
					updated_at = greatest(
						unit_follow_notification_preference.updated_at,
						excluded.updated_at
					)
				returning 1
			), deleted as (
				delete from unit_follow as follow
				using batch
				where follow.follower_profile_id = batch.follower_profile_id
					and follow.unit_id = ${input.sourceUnitId}::uuid
				returning 1
			)
			select cardinality(array(select 1 from deleted)) as processed,
				exists(
					select 1 from unit_follow where unit_id = ${input.sourceUnitId}::uuid
				) as remaining
		`,
	);
}

async function scoreBatch(
	tx: DatabaseTransaction,
	input: UnitMergePhaseInput,
): Promise<UnitMergePhaseResult> {
	return runBatch(
		tx,
		sql`
			with batch as materialized (
				select id, profile_id, realm_id, value, visibility, created_at, updated_at
				from score
				where unit_id = ${input.sourceUnitId}::uuid
				order by realm_id, value
				limit ${input.batchSize}
				for update skip locked
			), duplicate_map as materialized (
				select batch.id as source_score_id, canonical.id as target_score_id
				from batch
				join score as canonical
					on canonical.profile_id = batch.profile_id
					and canonical.unit_id = ${input.targetUnitId}::uuid
					and canonical.realm_id = batch.realm_id
			), duplicate_to_drain as materialized (
				select source_score_id, target_score_id
				from duplicate_map
				order by source_score_id
				limit 1
			), link_batch as materialized (
				select link.post_id, link.score_id as source_score_id,
					duplicate_to_drain.target_score_id
				from duplicate_to_drain
				join post_score as link
					on link.score_id = duplicate_to_drain.source_score_id
				order by link.post_id
				limit ${input.batchSize}
				for update of link skip locked
			), deleted_duplicate_links as (
				delete from post_score as link
				using link_batch
				where link.post_id = link_batch.post_id
					and link.score_id = link_batch.source_score_id
					and exists (
						select 1 from post_score as canonical_link
						where canonical_link.post_id = link.post_id
							and canonical_link.score_id = link_batch.target_score_id
					)
				returning 1
			), moved_links as (
				update post_score as link
				set score_id = link_batch.target_score_id,
					updated_at = clock_timestamp()
				from link_batch
				where link.post_id = link_batch.post_id
					and link.score_id = link_batch.source_score_id
					and not exists (
						select 1 from post_score as canonical_link
						where canonical_link.post_id = link.post_id
							and canonical_link.score_id = link_batch.target_score_id
					)
				returning 1
			), refreshed as (
				update score as canonical
				set value = case when batch.updated_at >= canonical.updated_at
						then batch.value else canonical.value end,
					visibility = case when batch.updated_at >= canonical.updated_at
						then batch.visibility else canonical.visibility end,
					created_at = least(canonical.created_at, batch.created_at),
					updated_at = greatest(canonical.updated_at, batch.updated_at)
				from duplicate_map
				join batch on batch.id = duplicate_map.source_score_id
				where canonical.id = duplicate_map.target_score_id
					and not exists (select 1 from link_batch)
				returning 1
			), deleted_duplicates as (
				delete from score as stored
				using duplicate_map
				where stored.id = duplicate_map.source_score_id
					and not exists (select 1 from link_batch)
					and not exists (
						select 1 from post_score
						where score_id = duplicate_map.source_score_id
					)
				returning 1
			), updated as (
				update score as stored
				set unit_id = ${input.targetUnitId}::uuid
				from batch
				where stored.id = batch.id
					and not exists (select 1 from link_batch)
					and not exists (
						select 1 from duplicate_map
						where duplicate_map.source_score_id = batch.id
					)
				returning 1
			)
			select (
				cardinality(array(select 1 from deleted_duplicate_links)) +
				cardinality(array(select 1 from moved_links)) +
				cardinality(array(select 1 from deleted_duplicates)) +
				cardinality(array(select 1 from updated))
			)::int as processed,
				exists(select 1 from score where unit_id = ${input.sourceUnitId}::uuid) as remaining
		`,
	);
}

async function collectionItemBatch(
	tx: DatabaseTransaction,
	input: UnitMergePhaseInput,
): Promise<UnitMergePhaseResult> {
	return runBatch(
		tx,
		sql`
			with batch as materialized (
				select collection_id
				from collection_item
				where unit_id = ${input.sourceUnitId}::uuid
				order by collection_id
				limit ${input.batchSize}
				for update skip locked
			), deleted_duplicates as (
				delete from collection_item as item
				using batch
				where item.collection_id = batch.collection_id
					and item.unit_id = ${input.sourceUnitId}::uuid
					and exists (
						select 1 from collection_item as canonical
						where canonical.collection_id = batch.collection_id
							and canonical.unit_id = ${input.targetUnitId}::uuid
					)
				returning 1
			), updated as (
				update collection_item as item
				set unit_id = ${input.targetUnitId}::uuid,
					updated_at = clock_timestamp()
				from batch
				where item.collection_id = batch.collection_id
					and item.unit_id = ${input.sourceUnitId}::uuid
					and not exists (
						select 1 from collection_item as canonical
						where canonical.collection_id = batch.collection_id
							and canonical.unit_id = ${input.targetUnitId}::uuid
					)
				returning 1
			)
			select (
				cardinality(array(select 1 from deleted_duplicates)) +
				cardinality(array(select 1 from updated))
			)::int as processed,
			exists(
				select 1 from collection_item where unit_id = ${input.sourceUnitId}::uuid
			) as remaining
		`,
	);
}

async function unitTagBatch(
	tx: DatabaseTransaction,
	input: UnitMergePhaseInput,
): Promise<UnitMergePhaseResult> {
	await tx.execute(sql`
		with batch as materialized (
			select tag_id, created_by_profile_id, pinned, position, created_at, updated_at
			from unit_tag
			where unit_id = ${input.sourceUnitId}::uuid
			order by tag_id
			limit ${input.batchSize}
			for update skip locked
		), hot_keys as materialized (
			select distinct affected.unit_id, batch.tag_id, null::uuid as profile_id
			from batch
			cross join (values
				(${input.sourceUnitId}::uuid),
				(${input.targetUnitId}::uuid)
			) as affected(unit_id)
		), admission as materialized (
			select public.lock_vndb_vote_hot_keys(
				coalesce(
					array_agg(hot_keys.unit_id order by hot_keys.unit_id, hot_keys.tag_id, hot_keys.profile_id),
					array[]::uuid[]
				),
				coalesce(
					array_agg(hot_keys.tag_id order by hot_keys.unit_id, hot_keys.tag_id, hot_keys.profile_id),
					array[]::uuid[]
				),
				coalesce(
					array_agg(hot_keys.profile_id order by hot_keys.unit_id, hot_keys.tag_id, hot_keys.profile_id),
					array[]::uuid[]
				)
			) as admitted
			from hot_keys
		)
		insert into unit_tag (
			unit_id, tag_id, created_by_profile_id, pinned, position,
			created_at, updated_at
		)
		select ${input.targetUnitId}::uuid, batch.tag_id, batch.created_by_profile_id,
			batch.pinned,
			case
				when batch.pinned and exists (
					select 1 from unit_tag as target_position
					where target_position.unit_id = ${input.targetUnitId}::uuid
						and target_position.pinned
						and target_position.position = batch.position
						and target_position.tag_id <> batch.tag_id
				) then 'a0'
					|| replace(${input.operationId}::text, '-', '')
					|| replace(${input.sourceUnitId}::text, '-', '')
					|| replace(batch.tag_id::text, '-', '')
					|| 'V'
				else batch.position
			end,
			batch.created_at, batch.updated_at
		from batch
		cross join admission
		on conflict (unit_id, tag_id) do nothing
	`);
	await tx.execute(sql`
		with vote_batch as materialized (
			select vote.tag_id, vote.profile_id,
				vote.fit_vote, vote.spoiler_level,
				vote.fit_updated_at, vote.spoiler_updated_at,
				vote.created_at, vote.updated_at
			from unit_tag_judgment as vote
			where vote.unit_id = ${input.sourceUnitId}::uuid
				and exists (
					select 1 from unit_tag as target
					where target.unit_id = ${input.targetUnitId}::uuid
						and target.tag_id = vote.tag_id
				)
			order by vote.tag_id, vote.profile_id
			limit ${input.batchSize}
			for update of vote skip locked
		), hot_keys as materialized (
			select distinct affected.unit_id, vote_batch.tag_id, vote_batch.profile_id
			from vote_batch
			cross join (values
				(${input.sourceUnitId}::uuid),
				(${input.targetUnitId}::uuid)
			) as affected(unit_id)
		), admission as materialized (
			select public.lock_vndb_vote_hot_keys(
				coalesce(
					array_agg(hot_keys.unit_id order by hot_keys.unit_id, hot_keys.tag_id, hot_keys.profile_id),
					array[]::uuid[]
				),
				coalesce(
					array_agg(hot_keys.tag_id order by hot_keys.unit_id, hot_keys.tag_id, hot_keys.profile_id),
					array[]::uuid[]
				),
				coalesce(
					array_agg(hot_keys.profile_id order by hot_keys.unit_id, hot_keys.tag_id, hot_keys.profile_id),
					array[]::uuid[]
				)
			) as admitted
			from hot_keys
		)
		insert into unit_tag_judgment (
			unit_id, tag_id, profile_id, fit_vote, spoiler_level,
			fit_updated_at, spoiler_updated_at, created_at, updated_at
		)
		select ${input.targetUnitId}::uuid, tag_id, profile_id,
			fit_vote, spoiler_level, fit_updated_at, spoiler_updated_at,
			created_at, updated_at
		from vote_batch
		cross join admission
		on conflict (unit_id, tag_id, profile_id) do update
		set fit_vote = case
				when excluded.fit_updated_at is not null
					and (
						unit_tag_judgment.fit_updated_at is null
						or excluded.fit_updated_at > unit_tag_judgment.fit_updated_at
					)
					then excluded.fit_vote
				else unit_tag_judgment.fit_vote
			end,
			fit_updated_at = greatest(
				unit_tag_judgment.fit_updated_at,
				excluded.fit_updated_at
			),
			spoiler_level = case
				when excluded.spoiler_updated_at is not null
					and (
						unit_tag_judgment.spoiler_updated_at is null
						or excluded.spoiler_updated_at > unit_tag_judgment.spoiler_updated_at
					)
					then excluded.spoiler_level
				else unit_tag_judgment.spoiler_level
			end,
			spoiler_updated_at = greatest(
				unit_tag_judgment.spoiler_updated_at,
				excluded.spoiler_updated_at
			),
			created_at = least(unit_tag_judgment.created_at, excluded.created_at),
			updated_at = greatest(unit_tag_judgment.updated_at, excluded.updated_at)
	`);
	const evidenceResult = await tx.execute<{ readonly processed: number | string }>(sql`
		with batch as materialized (
			select evidence.import_id, evidence.source_fingerprint
			from content_pack_unit_tag_evidence as evidence
			join unit_tag_judgment as target
				on target.unit_id = ${input.targetUnitId}::uuid
				and target.tag_id = evidence.tag_id
				and target.profile_id = evidence.profile_id
			where evidence.unit_id = ${input.sourceUnitId}::uuid
			order by evidence.tag_id, evidence.profile_id,
				evidence.import_id, evidence.source_fingerprint
			limit ${input.batchSize}
			for update of evidence skip locked
		), updated as (
			update content_pack_unit_tag_evidence as evidence
			set unit_id = ${input.targetUnitId}::uuid
			from batch
			where evidence.import_id = batch.import_id
				and evidence.source_fingerprint = batch.source_fingerprint
			returning 1
		)
		select cardinality(array(select 1 from updated))::int as processed
	`);
	const relationResult = await runBatch(
		tx,
		sql`
			with batch as materialized (
				select source.tag_id
				from unit_tag as source
				where source.unit_id = ${input.sourceUnitId}::uuid
					and exists (
						select 1 from unit_tag as target
						where target.unit_id = ${input.targetUnitId}::uuid
							and target.tag_id = source.tag_id
					)
				order by tag_id
				limit ${input.batchSize}
				for update of source skip locked
			), tag_to_drain as materialized (
				select tag_id from batch
				order by batch.tag_id
				limit 1
			), vote_batch as materialized (
				select vote.tag_id, vote.profile_id,
					vote.fit_vote, vote.spoiler_level,
					vote.fit_updated_at, vote.spoiler_updated_at,
					vote.created_at, vote.updated_at
				from tag_to_drain
				join unit_tag_judgment as vote on vote.tag_id = tag_to_drain.tag_id
				where vote.unit_id = ${input.sourceUnitId}::uuid
				order by vote.profile_id
				limit ${input.batchSize}
				for update of vote skip locked
			), hot_keys as materialized (
				select affected.unit_id, batch.tag_id, null::uuid as profile_id
				from batch
				cross join (values
					(${input.sourceUnitId}::uuid),
					(${input.targetUnitId}::uuid)
				) as affected(unit_id)
				union
				select affected.unit_id, vote_batch.tag_id, vote_batch.profile_id
				from vote_batch
				cross join (values
					(${input.sourceUnitId}::uuid),
					(${input.targetUnitId}::uuid)
				) as affected(unit_id)
			), admission as materialized (
				select public.lock_vndb_vote_hot_keys(
					coalesce(
						array_agg(hot_keys.unit_id order by hot_keys.unit_id, hot_keys.tag_id, hot_keys.profile_id),
						array[]::uuid[]
					),
					coalesce(
						array_agg(hot_keys.tag_id order by hot_keys.unit_id, hot_keys.tag_id, hot_keys.profile_id),
						array[]::uuid[]
					),
					coalesce(
						array_agg(hot_keys.profile_id order by hot_keys.unit_id, hot_keys.tag_id, hot_keys.profile_id),
						array[]::uuid[]
					)
				) as admitted
				from hot_keys
			), copied_votes as (
				insert into unit_tag_judgment (
					unit_id, tag_id, profile_id, fit_vote, spoiler_level,
					fit_updated_at, spoiler_updated_at, created_at, updated_at
				)
				select ${input.targetUnitId}::uuid, tag_id, profile_id,
					fit_vote, spoiler_level, fit_updated_at, spoiler_updated_at,
					created_at, updated_at
				from vote_batch
				cross join admission
				on conflict (unit_id, tag_id, profile_id) do update
				set fit_vote = case
						when excluded.fit_updated_at is not null
							and (
								unit_tag_judgment.fit_updated_at is null
								or excluded.fit_updated_at > unit_tag_judgment.fit_updated_at
							)
							then excluded.fit_vote
						else unit_tag_judgment.fit_vote
					end,
					fit_updated_at = greatest(
						unit_tag_judgment.fit_updated_at,
						excluded.fit_updated_at
					),
					spoiler_level = case
						when excluded.spoiler_updated_at is not null
							and (
								unit_tag_judgment.spoiler_updated_at is null
								or excluded.spoiler_updated_at > unit_tag_judgment.spoiler_updated_at
							)
							then excluded.spoiler_level
						else unit_tag_judgment.spoiler_level
					end,
					spoiler_updated_at = greatest(
						unit_tag_judgment.spoiler_updated_at,
						excluded.spoiler_updated_at
					),
					created_at = least(unit_tag_judgment.created_at, excluded.created_at),
					updated_at = greatest(unit_tag_judgment.updated_at, excluded.updated_at)
				returning 1
			), deleted_votes as (
				delete from unit_tag_judgment as vote
				using vote_batch, admission
				where vote.unit_id = ${input.sourceUnitId}::uuid
					and vote.tag_id = vote_batch.tag_id
					and vote.profile_id = vote_batch.profile_id
					and not exists (
						select 1 from content_pack_unit_tag_evidence as evidence
						where evidence.unit_id = ${input.sourceUnitId}::uuid
							and evidence.tag_id = vote_batch.tag_id
							and evidence.profile_id = vote_batch.profile_id
					)
				returning 1
			), deleted as (
				delete from unit_tag as relation
				using batch, admission
				where relation.unit_id = ${input.sourceUnitId}::uuid
					and relation.tag_id = batch.tag_id
					and not exists (select 1 from vote_batch)
					and not exists (
						select 1 from unit_tag_judgment
						where unit_id = ${input.sourceUnitId}::uuid
							and tag_id = batch.tag_id
					)
					and not exists (
						select 1 from content_pack_unit_tag_evidence as evidence
						where evidence.unit_id = ${input.sourceUnitId}::uuid
							and evidence.tag_id = batch.tag_id
					)
				returning 1
			)
			select (
				cardinality(array(select 1 from deleted_votes)) +
				cardinality(array(select 1 from deleted))
			)::int as processed,
				exists(select 1 from unit_tag where unit_id = ${input.sourceUnitId}::uuid) as remaining
		`,
	);
	return {
		processedRows: Number(evidenceResult.rows[0]?.processed ?? 0) + relationResult.processedRows,
		done: relationResult.done,
	};
}

async function realmTagJudgmentBatch(
	tx: DatabaseTransaction,
	input: UnitMergePhaseInput,
): Promise<UnitMergePhaseResult> {
	return runBatch(
		tx,
		sql`
			with batch as materialized (
				select realm_id, tag_id, profile_id,
					fit_vote, spoiler_level, fit_updated_at, spoiler_updated_at,
					created_at, updated_at
				from realm_tag_judgment
				where unit_id = ${input.sourceUnitId}::uuid
				order by realm_id, tag_id, profile_id
				limit ${input.batchSize}
				for update skip locked
			), hot_keys as materialized (
				select distinct batch.realm_id, affected.unit_id, batch.tag_id
				from batch
				cross join (values
					(${input.sourceUnitId}::uuid),
					(${input.targetUnitId}::uuid)
				) as affected(unit_id)
			), admission as materialized (
				select public.lock_realm_tag_judgment_keys(
					coalesce(
						array_agg(hot_keys.realm_id order by hot_keys.realm_id, hot_keys.unit_id, hot_keys.tag_id),
						array[]::uuid[]
					),
					coalesce(
						array_agg(hot_keys.unit_id order by hot_keys.realm_id, hot_keys.unit_id, hot_keys.tag_id),
						array[]::uuid[]
					),
					coalesce(
						array_agg(hot_keys.tag_id order by hot_keys.realm_id, hot_keys.unit_id, hot_keys.tag_id),
						array[]::uuid[]
					)
				) as admitted
				from hot_keys
			), copied as (
				insert into realm_tag_judgment (
					realm_id, unit_id, tag_id, profile_id, fit_vote, spoiler_level,
					fit_updated_at, spoiler_updated_at, created_at, updated_at
				)
				select realm_id, ${input.targetUnitId}::uuid, tag_id, profile_id,
					fit_vote, spoiler_level, fit_updated_at, spoiler_updated_at,
					created_at, updated_at
				from batch
				cross join admission
				on conflict (realm_id, unit_id, tag_id, profile_id) do update
				set fit_vote = case
						when excluded.fit_updated_at is not null
							and (
								realm_tag_judgment.fit_updated_at is null
								or excluded.fit_updated_at > realm_tag_judgment.fit_updated_at
							)
							then excluded.fit_vote
						else realm_tag_judgment.fit_vote
					end,
					fit_updated_at = greatest(
						realm_tag_judgment.fit_updated_at,
						excluded.fit_updated_at
					),
					spoiler_level = case
						when excluded.spoiler_updated_at is not null
							and (
								realm_tag_judgment.spoiler_updated_at is null
								or excluded.spoiler_updated_at > realm_tag_judgment.spoiler_updated_at
							)
							then excluded.spoiler_level
						else realm_tag_judgment.spoiler_level
					end,
					spoiler_updated_at = greatest(
						realm_tag_judgment.spoiler_updated_at,
						excluded.spoiler_updated_at
					),
					created_at = least(realm_tag_judgment.created_at, excluded.created_at),
					updated_at = greatest(realm_tag_judgment.updated_at, excluded.updated_at)
				returning 1
			), deleted as (
				delete from realm_tag_judgment as vote
				using batch, admission
				where vote.realm_id = batch.realm_id
					and vote.unit_id = ${input.sourceUnitId}::uuid
					and vote.tag_id = batch.tag_id
					and vote.profile_id = batch.profile_id
				returning 1
			)
			select cardinality(array(select 1 from deleted)) as processed,
				exists(
					select 1 from realm_tag_judgment where unit_id = ${input.sourceUnitId}::uuid
				) as remaining
		`,
	);
}

async function profileUnitTagBatch(
	tx: DatabaseTransaction,
	input: UnitMergePhaseInput,
): Promise<UnitMergePhaseResult> {
	return runBatch(
		tx,
		sql`
			with batch as materialized (
				select profile_id, tag_id, position, created_at, updated_at
				from profile_unit_tag
				where unit_id = ${input.sourceUnitId}::uuid
				order by profile_id
				limit ${input.batchSize}
				for update skip locked
			), inserted_targets as (
				insert into profile_unit_tag (
					profile_id, unit_id, tag_id, position, created_at, updated_at
				)
				select profile_id, ${input.targetUnitId}::uuid, tag_id,
					position, created_at, updated_at
				from batch
				on conflict (profile_id, unit_id, tag_id) do nothing
				returning profile_id, tag_id
			), ensured_targets as materialized (
				select profile_id, tag_id from inserted_targets
				union
				select batch.profile_id, batch.tag_id
				from batch
				where exists (
					select 1 from profile_unit_tag as target
					where target.profile_id = batch.profile_id
						and target.unit_id = ${input.targetUnitId}::uuid
						and target.tag_id = batch.tag_id
				)
			), deleted as (
				delete from profile_unit_tag as relation
				using ensured_targets
				where relation.profile_id = ensured_targets.profile_id
					and relation.unit_id = ${input.sourceUnitId}::uuid
					and relation.tag_id = ensured_targets.tag_id
				returning 1
			)
			select cardinality(array(select 1 from deleted)) as processed,
				exists(
					select 1 from profile_unit_tag where unit_id = ${input.sourceUnitId}::uuid
				) as remaining
		`,
	);
}

async function realmPinBatch(
	tx: DatabaseTransaction,
	input: UnitMergePhaseInput,
): Promise<UnitMergePhaseResult> {
	return runBatch(
		tx,
		sql`
			with batch as materialized (
				select realm_id, kind, position, created_by_profile_id, created_at, updated_at
				from realm_pin
				where unit_id = ${input.sourceUnitId}::uuid
				limit ${input.batchSize}
				for update skip locked
			), copied as (
				insert into realm_pin (
					realm_id, unit_id, kind, position, created_by_profile_id, created_at, updated_at
				)
				select realm_id, ${input.targetUnitId}::uuid, kind, position,
					created_by_profile_id, created_at, updated_at
				from batch
				on conflict (realm_id, unit_id) do update
				set created_at = least(realm_pin.created_at, excluded.created_at),
					updated_at = greatest(realm_pin.updated_at, excluded.updated_at)
				returning 1
			), deleted as (
				delete from realm_pin as pin
				using batch
				where pin.realm_id = batch.realm_id
					and pin.unit_id = ${input.sourceUnitId}::uuid
				returning 1
			)
			select cardinality(array(select 1 from deleted)) as processed,
				exists(select 1 from realm_pin where unit_id = ${input.sourceUnitId}::uuid) as remaining
		`,
	);
}

async function realmUnitBatch(
	tx: DatabaseTransaction,
	input: UnitMergePhaseInput,
): Promise<UnitMergePhaseResult> {
	return runBatch(
		tx,
		sql`
			with batch as materialized (
				select realm_id, post_targeting_locked, status, publication_state,
					created_at, updated_at
				from realm_unit
				where unit_id = ${input.sourceUnitId}::uuid
					and publication_state <> 'withdrawn'
				order by publication_state, status, updated_at desc, realm_id desc
				limit ${input.batchSize}
				for update skip locked
			), copied as (
				insert into realm_unit (
					realm_id, unit_id, post_targeting_locked, status,
					publication_state, created_at, updated_at
				)
				select realm_id, ${input.targetUnitId}::uuid, post_targeting_locked,
					status, publication_state, created_at, updated_at
				from batch
				on conflict (realm_id, unit_id) do update
				set post_targeting_locked = realm_unit.post_targeting_locked
						or excluded.post_targeting_locked,
					created_at = least(realm_unit.created_at, excluded.created_at),
					updated_at = greatest(realm_unit.updated_at, excluded.updated_at)
				returning 1
			), withdrawn as (
				update realm_unit as relation
				set publication_state = 'withdrawn',
					post_targeting_locked = true,
					updated_at = clock_timestamp()
				from batch
				where relation.realm_id = batch.realm_id
					and relation.unit_id = ${input.sourceUnitId}::uuid
				returning 1
			)
			select cardinality(array(select 1 from withdrawn)) as processed,
				exists(
					select 1 from realm_unit
					where unit_id = ${input.sourceUnitId}::uuid
						and publication_state <> 'withdrawn'
				) as remaining
		`,
	);
}

async function realmUnitTagBatch(
	tx: DatabaseTransaction,
	input: UnitMergePhaseInput,
): Promise<UnitMergePhaseResult> {
	return runBatch(
		tx,
		sql`
			with batch as materialized (
				select realm_id, tag_id, position, created_by_profile_id, created_at, updated_at
				from realm_unit_tag
				where unit_id = ${input.sourceUnitId}::uuid
				order by realm_id, tag_id
				limit ${input.batchSize}
				for update skip locked
			), inserted_targets as (
				insert into realm_unit_tag (
					realm_id, unit_id, tag_id, position, created_by_profile_id, created_at, updated_at
				)
				select realm_id, ${input.targetUnitId}::uuid, tag_id, position,
					created_by_profile_id, created_at, updated_at
				from batch
				on conflict (realm_id, unit_id, tag_id) do nothing
				returning realm_id, tag_id
			), ensured_targets as materialized (
				select realm_id, tag_id from inserted_targets
				union
				select batch.realm_id, batch.tag_id
				from batch
				where exists (
					select 1 from realm_unit_tag as target
					where target.realm_id = batch.realm_id
						and target.unit_id = ${input.targetUnitId}::uuid
						and target.tag_id = batch.tag_id
				)
			), deleted as (
				delete from realm_unit_tag as relation
				using ensured_targets
				where relation.realm_id = ensured_targets.realm_id
					and relation.unit_id = ${input.sourceUnitId}::uuid
					and relation.tag_id = ensured_targets.tag_id
				returning 1
			)
			select cardinality(array(select 1 from deleted)) as processed,
				exists(
					select 1 from realm_unit_tag where unit_id = ${input.sourceUnitId}::uuid
				) as remaining
		`,
	);
}

async function associationProposalBatch(
	tx: DatabaseTransaction,
	input: UnitMergePhaseInput,
	direction: "source_unit_id" | "target_unit_id",
): Promise<UnitMergePhaseResult> {
	const column = sql.identifier(direction);
	const opposite = sql.identifier(
		direction === "source_unit_id" ? "target_unit_id" : "source_unit_id",
	);
	return runBatch(
		tx,
		sql`
			with batch as materialized (
				select id
				from unit_association_proposal
				where ${column} = ${input.sourceUnitId}::uuid
					and resolution is null
				order by created_at desc, id desc
				limit ${input.batchSize}
				for update skip locked
			), deleted_self as (
				delete from unit_association_proposal as proposal
				using batch
				where proposal.id = batch.id
					and proposal.${opposite} = ${input.targetUnitId}::uuid
				returning 1
			), updated as (
				update unit_association_proposal as proposal
				set ${column} = ${input.targetUnitId}::uuid,
					updated_at = clock_timestamp()
				from batch
				where proposal.id = batch.id
					and proposal.${opposite} <> ${input.targetUnitId}::uuid
				returning 1
			)
			select (
				cardinality(array(select 1 from deleted_self)) +
				cardinality(array(select 1 from updated))
			)::int as processed,
			exists(
				select 1 from unit_association_proposal
				where ${column} = ${input.sourceUnitId}::uuid and resolution is null
			) as remaining
		`,
	);
}

async function creditBatch(
	tx: DatabaseTransaction,
	input: UnitMergePhaseInput,
	direction: "source_unit_id" | "credited_unit_id",
): Promise<UnitMergePhaseResult> {
	const column = sql.identifier(direction);
	const otherColumn = sql.identifier(
		direction === "source_unit_id" ? "credited_unit_id" : "source_unit_id",
	);
	return runBatch(
		tx,
		sql`
			with batch as materialized (
				select id, source_unit_id, credited_unit_id, role
				from credit_attribution
				where ${column} = ${input.sourceUnitId}::uuid
				limit ${input.batchSize}
				for update skip locked
			), deleted_invalid as (
				delete from credit_attribution as attribution
				using batch
				where attribution.id = batch.id
					and (
						batch.${otherColumn} = ${input.targetUnitId}::uuid
						or exists (
							select 1 from credit_attribution as canonical
							where canonical.source_unit_id = case
								when ${direction} = 'source_unit_id'
									then ${input.targetUnitId}::uuid
								else batch.source_unit_id
							end
								and canonical.credited_unit_id = case
									when ${direction} = 'credited_unit_id'
										then ${input.targetUnitId}::uuid
									else batch.credited_unit_id
								end
								and canonical.role = batch.role
								and canonical.id <> batch.id
						)
					)
				returning 1
			), updated as (
				update credit_attribution as attribution
				set ${column} = ${input.targetUnitId}::uuid,
					updated_at = clock_timestamp()
				from batch
				where attribution.id = batch.id
					and attribution.${otherColumn} <> ${input.targetUnitId}::uuid
					and not exists (
						select 1 from credit_attribution as canonical
						where canonical.source_unit_id = case
							when ${direction} = 'source_unit_id'
								then ${input.targetUnitId}::uuid
							else batch.source_unit_id
						end
							and canonical.credited_unit_id = case
								when ${direction} = 'credited_unit_id'
									then ${input.targetUnitId}::uuid
								else batch.credited_unit_id
							end
							and canonical.role = batch.role
							and canonical.id <> batch.id
					)
				returning 1
			)
			select (
				cardinality(array(select 1 from deleted_invalid)) +
				cardinality(array(select 1 from updated))
			)::int as processed,
			exists(select 1 from credit_attribution where ${column} = ${input.sourceUnitId}::uuid)
				as remaining
		`,
	);
}

async function subjectAssociationBatch(
	tx: DatabaseTransaction,
	input: UnitMergePhaseInput,
	direction: "unit_id" | "entity_id",
): Promise<UnitMergePhaseResult> {
	const column = sql.identifier(direction);
	const otherColumn = sql.identifier(direction === "unit_id" ? "entity_id" : "unit_id");
	const selfEvidence = await tx.execute<{ readonly conflict: boolean }>(sql`
		select exists (
			select 1
			from subject_association as association
			join content_pack_subject_association_evidence as evidence
				on evidence.association_id = association.id
			where association.${column} = ${input.sourceUnitId}::uuid
				and association.${otherColumn} = ${input.targetUnitId}::uuid
		) as conflict
	`);
	if (selfEvidence.rows[0]?.conflict)
		throw new UnitMergeEvidenceConflict("subject_self_association");

	await tx.execute(sql`
		with judgment_batch as materialized (
			select judgment.association_id, judgment.profile_id,
				judgment.spoiler_level, judgment.created_at, judgment.updated_at,
				canonical.id as canonical_id
			from subject_association as source
			join subject_association as canonical
				on canonical.unit_id = case
					when ${direction} = 'unit_id' then ${input.targetUnitId}::uuid
					else source.unit_id
				end
				and canonical.entity_id = case
					when ${direction} = 'entity_id' then ${input.targetUnitId}::uuid
					else source.entity_id
				end
				and canonical.role = source.role
				and canonical.id <> source.id
			join subject_association_judgment as judgment
				on judgment.association_id = source.id
			where source.${column} = ${input.sourceUnitId}::uuid
			order by source.id, judgment.profile_id
			limit ${input.batchSize}
			for update of judgment skip locked
		)
		insert into subject_association_judgment (
			association_id, profile_id, spoiler_level, created_at, updated_at
		)
		select canonical_id, profile_id, spoiler_level, created_at, updated_at
		from judgment_batch
		on conflict (association_id, profile_id) do update
		set spoiler_level = case
				when excluded.updated_at > subject_association_judgment.updated_at
					then excluded.spoiler_level
				else subject_association_judgment.spoiler_level
			end,
			created_at = least(
				subject_association_judgment.created_at,
				excluded.created_at
			),
			updated_at = greatest(
				subject_association_judgment.updated_at,
				excluded.updated_at
			)
	`);
	const evidenceResult = await tx.execute<{ readonly processed: number | string }>(sql`
		with batch as materialized (
			select evidence.import_id, evidence.source_fingerprint,
				canonical.id as canonical_id
			from content_pack_subject_association_evidence as evidence
			join subject_association as source
				on source.id = evidence.association_id
			join subject_association as canonical
				on canonical.unit_id = case
					when ${direction} = 'unit_id' then ${input.targetUnitId}::uuid
					else source.unit_id
				end
				and canonical.entity_id = case
					when ${direction} = 'entity_id' then ${input.targetUnitId}::uuid
					else source.entity_id
				end
				and canonical.role = source.role
				and canonical.id <> source.id
			join subject_association_judgment as target
				on target.association_id = canonical.id
				and target.profile_id = evidence.profile_id
			where source.${column} = ${input.sourceUnitId}::uuid
			order by evidence.association_id, evidence.profile_id,
				evidence.import_id, evidence.source_fingerprint
			limit ${input.batchSize}
			for update of evidence skip locked
		), updated as (
			update content_pack_subject_association_evidence as evidence
			set association_id = batch.canonical_id
			from batch
			where evidence.import_id = batch.import_id
				and evidence.source_fingerprint = batch.source_fingerprint
			returning 1
		)
		select cardinality(array(select 1 from updated))::int as processed
	`);
	const relationResult = await runBatch(
		tx,
		sql`
			with batch as materialized (
				select id, unit_id, entity_id, role
				from subject_association
				where ${column} = ${input.sourceUnitId}::uuid
				order by ${otherColumn}, role
				limit ${input.batchSize}
				for update skip locked
			), classified as materialized (
				select batch.*,
					canonical.id as canonical_id,
					batch.${otherColumn} = ${input.targetUnitId}::uuid as becomes_self
				from batch
				left join subject_association as canonical
					on canonical.unit_id = case
						when ${direction} = 'unit_id' then ${input.targetUnitId}::uuid
						else batch.unit_id
					end
					and canonical.entity_id = case
						when ${direction} = 'entity_id' then ${input.targetUnitId}::uuid
						else batch.entity_id
					end
					and canonical.role = batch.role
					and canonical.id <> batch.id
			), association_to_drain as materialized (
				select id, canonical_id
				from classified
				where becomes_self or canonical_id is not null
				order by id
				limit 1
			), judgment_batch as materialized (
				select judgment.association_id, judgment.profile_id,
					judgment.spoiler_level, judgment.created_at, judgment.updated_at,
					association_to_drain.canonical_id
				from association_to_drain
				join subject_association_judgment as judgment
					on judgment.association_id = association_to_drain.id
				order by judgment.profile_id
				limit ${input.batchSize}
				for update of judgment skip locked
			), copied_judgments as (
				insert into subject_association_judgment (
					association_id, profile_id, spoiler_level, created_at, updated_at
				)
				select canonical_id, profile_id, spoiler_level, created_at, updated_at
				from judgment_batch
				where canonical_id is not null
				on conflict (association_id, profile_id) do update
				set spoiler_level = case
						when excluded.updated_at > subject_association_judgment.updated_at
							then excluded.spoiler_level
						else subject_association_judgment.spoiler_level
					end,
					created_at = least(
						subject_association_judgment.created_at,
						excluded.created_at
					),
					updated_at = greatest(
						subject_association_judgment.updated_at,
						excluded.updated_at
					)
				returning association_id, profile_id
			), deleted_judgments as (
				delete from subject_association_judgment as judgment
				using judgment_batch
				where judgment.association_id = judgment_batch.association_id
					and judgment.profile_id = judgment_batch.profile_id
					and (
						judgment_batch.canonical_id is null
						or exists (
							select 1
							from copied_judgments
							where copied_judgments.association_id = judgment_batch.canonical_id
								and copied_judgments.profile_id = judgment_batch.profile_id
						)
					)
					and not exists (
						select 1 from content_pack_subject_association_evidence as evidence
						where evidence.association_id = judgment_batch.association_id
							and evidence.profile_id = judgment_batch.profile_id
					)
				returning 1
			), deleted_invalid as (
				delete from subject_association as association
				using classified
				where association.id = classified.id
					and (classified.becomes_self or classified.canonical_id is not null)
					and not exists (
						select 1
						from subject_association_judgment
						where association_id = classified.id
					)
					and not exists (
						select 1 from content_pack_subject_association_evidence as evidence
						where evidence.association_id = classified.id
					)
				returning 1
			), updated as (
				update subject_association as association
				set ${column} = ${input.targetUnitId}::uuid,
					updated_at = clock_timestamp()
				from classified
				where association.id = classified.id
					and not classified.becomes_self
					and classified.canonical_id is null
				returning 1
			)
			select (
				cardinality(array(select 1 from deleted_judgments)) +
				cardinality(array(select 1 from deleted_invalid)) +
				cardinality(array(select 1 from updated))
			)::int as processed,
			exists(select 1 from subject_association where ${column} = ${input.sourceUnitId}::uuid)
				as remaining
		`,
	);
	return {
		processedRows: Number(evidenceResult.rows[0]?.processed ?? 0) + relationResult.processedRows,
		done: relationResult.done,
	};
}

async function releaseParentBatch(
	tx: DatabaseTransaction,
	input: UnitMergePhaseInput,
): Promise<UnitMergePhaseResult> {
	return runBatch(
		tx,
		sql`
			with batch as materialized (
				select id, version_label
				from release
				where parent_unit_id = ${input.sourceUnitId}::uuid
				order by released_on, id
				limit ${input.batchSize}
				for update skip locked
			), updated as (
				update release as child
				set parent_unit_id = ${input.targetUnitId}::uuid,
					version_label = case
						when exists (
							select 1 from release as canonical
							where canonical.parent_unit_id = ${input.targetUnitId}::uuid
								and canonical.version_label = batch.version_label
								and canonical.id <> batch.id
						) then batch.version_label || ' · ' || batch.id::text
						else batch.version_label
					end,
					updated_at = clock_timestamp()
				from batch
				where child.id = batch.id
				returning 1
			)
			select cardinality(array(select 1 from updated)) as processed,
				exists(
					select 1 from release where parent_unit_id = ${input.sourceUnitId}::uuid
				) as remaining
		`,
	);
}

async function seriesReleaseBatch(
	tx: DatabaseTransaction,
	input: UnitMergePhaseInput,
): Promise<UnitMergePhaseResult> {
	return runBatch(
		tx,
		sql`
			with batch as materialized (
				select series_id
				from series_release
				where release_unit_id = ${input.sourceUnitId}::uuid
				order by series_id
				limit ${input.batchSize}
				for update skip locked
			), deleted_duplicates as (
				delete from series_release as membership
				using batch
				where membership.series_id = batch.series_id
					and membership.release_unit_id = ${input.sourceUnitId}::uuid
					and exists (
						select 1 from series_release as canonical
						where canonical.series_id = batch.series_id
							and canonical.release_unit_id = ${input.targetUnitId}::uuid
					)
				returning 1
			), updated as (
				update series_release as membership
				set release_unit_id = ${input.targetUnitId}::uuid,
					updated_at = clock_timestamp()
				from batch
				where membership.series_id = batch.series_id
					and membership.release_unit_id = ${input.sourceUnitId}::uuid
					and not exists (
						select 1 from series_release as canonical
						where canonical.series_id = batch.series_id
							and canonical.release_unit_id = ${input.targetUnitId}::uuid
					)
				returning 1
			)
			select (
				cardinality(array(select 1 from deleted_duplicates)) +
				cardinality(array(select 1 from updated))
			)::int as processed,
			exists(
				select 1 from series_release where release_unit_id = ${input.sourceUnitId}::uuid
			) as remaining
		`,
	);
}

async function structureApplicationBatch(
	tx: DatabaseTransaction,
	input: UnitMergePhaseInput,
): Promise<UnitMergePhaseResult> {
	await tx.execute(sql`
		with batch as materialized (
			select structure_id, created_by_profile_id, created_at, updated_at
			from unit_structure_application
			where unit_id = ${input.sourceUnitId}::uuid
			order by structure_id
			limit ${input.batchSize}
			for update skip locked
		)
		insert into unit_structure_application (
			unit_id, structure_id, created_by_profile_id, pinned, position,
			created_at, updated_at
		)
		select ${input.targetUnitId}::uuid, structure_id, created_by_profile_id,
			false, null, created_at, updated_at
		from batch
		on conflict (unit_id, structure_id) do update
		set updated_at = greatest(
			unit_structure_application.updated_at,
			excluded.updated_at
		)
	`);
	await tx.execute(sql`
		with vote_batch as materialized (
			select vote.structure_id, vote.profile_id,
				vote.fit_vote, vote.spoiler_level,
				vote.fit_updated_at, vote.spoiler_updated_at,
				vote.created_at, vote.updated_at
			from unit_structure_application_judgment as vote
			where vote.unit_id = ${input.sourceUnitId}::uuid
				and exists (
					select 1 from unit_structure_application as target
					where target.unit_id = ${input.targetUnitId}::uuid
						and target.structure_id = vote.structure_id
				)
			order by vote.structure_id, vote.profile_id
			limit ${input.batchSize}
			for update of vote skip locked
		)
		insert into unit_structure_application_judgment (
			unit_id, structure_id, profile_id, fit_vote, spoiler_level,
			fit_updated_at, spoiler_updated_at, created_at, updated_at
		)
		select ${input.targetUnitId}::uuid, structure_id, profile_id,
			fit_vote, spoiler_level, fit_updated_at, spoiler_updated_at,
			created_at, updated_at
		from vote_batch
		on conflict (unit_id, structure_id, profile_id) do update
		set fit_vote = case
				when excluded.fit_updated_at is not null
					and (
						unit_structure_application_judgment.fit_updated_at is null
						or excluded.fit_updated_at
							> unit_structure_application_judgment.fit_updated_at
					)
					then excluded.fit_vote
				else unit_structure_application_judgment.fit_vote
			end,
			fit_updated_at = greatest(
				unit_structure_application_judgment.fit_updated_at,
				excluded.fit_updated_at
			),
			spoiler_level = case
				when excluded.spoiler_updated_at is not null
					and (
						unit_structure_application_judgment.spoiler_updated_at is null
						or excluded.spoiler_updated_at
							> unit_structure_application_judgment.spoiler_updated_at
					)
					then excluded.spoiler_level
				else unit_structure_application_judgment.spoiler_level
			end,
			spoiler_updated_at = greatest(
				unit_structure_application_judgment.spoiler_updated_at,
				excluded.spoiler_updated_at
			),
			created_at = least(
				unit_structure_application_judgment.created_at,
				excluded.created_at
			),
			updated_at = greatest(
				unit_structure_application_judgment.updated_at,
				excluded.updated_at
			)
	`);
	const evidenceResult = await tx.execute<{ readonly processed: number | string }>(sql`
		with batch as materialized (
			select evidence.import_id, evidence.source_fingerprint
			from content_pack_structure_application_evidence as evidence
			join unit_structure_application_judgment as target
				on target.unit_id = ${input.targetUnitId}::uuid
				and target.structure_id = evidence.structure_id
				and target.profile_id = evidence.profile_id
			where evidence.unit_id = ${input.sourceUnitId}::uuid
			order by evidence.structure_id, evidence.profile_id,
				evidence.import_id, evidence.source_fingerprint
			limit ${input.batchSize}
			for update of evidence skip locked
		), updated as (
			update content_pack_structure_application_evidence as evidence
			set unit_id = ${input.targetUnitId}::uuid
			from batch
			where evidence.import_id = batch.import_id
				and evidence.source_fingerprint = batch.source_fingerprint
			returning 1
		)
		select cardinality(array(select 1 from updated))::int as processed
	`);
	const relationResult = await runBatch(
		tx,
		sql`
			with batch as materialized (
				select structure_id, created_by_profile_id, created_at, updated_at
				from unit_structure_application
				where unit_id = ${input.sourceUnitId}::uuid
				order by structure_id
				limit ${input.batchSize}
				for update skip locked
			), ensured_targets as (
				insert into unit_structure_application (
					unit_id, structure_id, created_by_profile_id, pinned, position,
					created_at, updated_at
				)
				select ${input.targetUnitId}::uuid, structure_id, created_by_profile_id,
					false, null, created_at, updated_at
				from batch
				on conflict (unit_id, structure_id) do update
				set updated_at = greatest(
					unit_structure_application.updated_at,
					excluded.updated_at
				)
				returning structure_id
			), application_to_drain as materialized (
				select batch.structure_id
				from batch
				join ensured_targets using (structure_id)
				order by batch.structure_id
				limit 1
			), vote_batch as materialized (
				select vote.structure_id, vote.profile_id,
					vote.fit_vote, vote.spoiler_level,
					vote.fit_updated_at, vote.spoiler_updated_at,
					vote.created_at, vote.updated_at
				from application_to_drain
				join unit_structure_application_judgment as vote
					on vote.structure_id = application_to_drain.structure_id
				where vote.unit_id = ${input.sourceUnitId}::uuid
				order by vote.profile_id
				limit ${input.batchSize}
				for update of vote skip locked
			), copied_votes as (
				insert into unit_structure_application_judgment (
					unit_id, structure_id, profile_id, fit_vote, spoiler_level,
					fit_updated_at, spoiler_updated_at, created_at, updated_at
				)
				select ${input.targetUnitId}::uuid, structure_id, profile_id,
					fit_vote, spoiler_level, fit_updated_at, spoiler_updated_at,
					created_at, updated_at
				from vote_batch
				on conflict (unit_id, structure_id, profile_id) do update
				set fit_vote = case
						when excluded.fit_updated_at is not null
							and (
								unit_structure_application_judgment.fit_updated_at is null
								or excluded.fit_updated_at
									> unit_structure_application_judgment.fit_updated_at
							)
							then excluded.fit_vote
						else unit_structure_application_judgment.fit_vote
					end,
					fit_updated_at = greatest(
						unit_structure_application_judgment.fit_updated_at,
						excluded.fit_updated_at
					),
					spoiler_level = case
						when excluded.spoiler_updated_at is not null
							and (
								unit_structure_application_judgment.spoiler_updated_at is null
								or excluded.spoiler_updated_at
									> unit_structure_application_judgment.spoiler_updated_at
							)
							then excluded.spoiler_level
						else unit_structure_application_judgment.spoiler_level
					end,
					spoiler_updated_at = greatest(
						unit_structure_application_judgment.spoiler_updated_at,
						excluded.spoiler_updated_at
					),
					created_at = least(
						unit_structure_application_judgment.created_at,
						excluded.created_at
					),
					updated_at = greatest(
						unit_structure_application_judgment.updated_at,
						excluded.updated_at
					)
				returning 1
			), deleted_votes as (
				delete from unit_structure_application_judgment as vote
				using vote_batch
				where vote.unit_id = ${input.sourceUnitId}::uuid
					and vote.structure_id = vote_batch.structure_id
					and vote.profile_id = vote_batch.profile_id
					and not exists (
						select 1 from content_pack_structure_application_evidence as evidence
						where evidence.unit_id = ${input.sourceUnitId}::uuid
							and evidence.structure_id = vote_batch.structure_id
							and evidence.profile_id = vote_batch.profile_id
					)
				returning 1
			), deleted as (
				delete from unit_structure_application as application
				using batch
				where application.unit_id = ${input.sourceUnitId}::uuid
					and application.structure_id = batch.structure_id
					and not exists (select 1 from vote_batch)
					and not exists (
						select 1 from unit_structure_application_judgment
						where unit_id = ${input.sourceUnitId}::uuid
							and structure_id = batch.structure_id
					)
					and not exists (
						select 1 from content_pack_structure_application_evidence as evidence
						where evidence.unit_id = ${input.sourceUnitId}::uuid
							and evidence.structure_id = batch.structure_id
					)
				returning 1
			)
			select (
				cardinality(array(select 1 from deleted_votes)) +
				cardinality(array(select 1 from deleted))
			)::int as processed,
				exists(
					select 1 from unit_structure_application
					where unit_id = ${input.sourceUnitId}::uuid
				) as remaining
		`,
	);
	return {
		processedRows: Number(evidenceResult.rows[0]?.processed ?? 0) + relationResult.processedRows,
		done: relationResult.done,
	};
}

async function progressEntryBatch(
	tx: DatabaseTransaction,
	input: UnitMergePhaseInput,
): Promise<UnitMergePhaseResult> {
	return runBatch(
		tx,
		sql`
			with batch as materialized (
				select id
				from unit_progress_entry
				where unit_id = ${input.sourceUnitId}::uuid
				order by id
				limit ${input.batchSize}
				for update skip locked
			), updated as (
				update unit_progress_entry as entry
				set unit_id = ${input.targetUnitId}::uuid,
					content_structure_node_id = null,
					content_structure_revision_id = null,
					updated_at = clock_timestamp()
				from batch
				where entry.id = batch.id
				returning 1
			)
			select cardinality(array(select 1 from updated)) as processed,
				exists(
					select 1 from unit_progress_entry where unit_id = ${input.sourceUnitId}::uuid
				) as remaining
		`,
	);
}

async function progressSnapshotBatch(
	tx: DatabaseTransaction,
	input: UnitMergePhaseInput,
): Promise<UnitMergePhaseResult> {
	return runBatch(
		tx,
		sql`
			with batch as materialized (
				select profile_id, progress, status, completed_count, total_time_ms,
					first_seen_at, last_seen_at, current_entry_id, current_basis,
					visibility, deleted_at, created_at, updated_at
				from unit_progress
				where unit_id = ${input.sourceUnitId}::uuid
				order by status
				limit ${input.batchSize}
				for update skip locked
			), copied as (
				insert into unit_progress (
					profile_id, unit_id, progress, status, completed_count, total_time_ms,
					first_seen_at, last_seen_at, last_content_structure_node_id,
					current_entry_id, current_basis, visibility, deleted_at,
					created_at, updated_at
				)
				select profile_id, ${input.targetUnitId}::uuid, progress, status,
					completed_count, total_time_ms, first_seen_at, last_seen_at,
					null, current_entry_id, current_basis, visibility, deleted_at,
					created_at, updated_at
				from batch
				on conflict (profile_id, unit_id) do update
				set progress = case
						when excluded.last_seen_at >= unit_progress.last_seen_at
							then excluded.progress else unit_progress.progress end,
					status = case
						when excluded.last_seen_at >= unit_progress.last_seen_at
							then excluded.status else unit_progress.status end,
					completed_count = unit_progress.completed_count + excluded.completed_count,
					total_time_ms = unit_progress.total_time_ms + excluded.total_time_ms,
					first_seen_at = least(unit_progress.first_seen_at, excluded.first_seen_at),
					last_seen_at = greatest(unit_progress.last_seen_at, excluded.last_seen_at),
					last_content_structure_node_id = null,
					current_entry_id = case
						when excluded.last_seen_at >= unit_progress.last_seen_at
							then excluded.current_entry_id else unit_progress.current_entry_id end,
					current_basis = case
						when excluded.last_seen_at >= unit_progress.last_seen_at
							then excluded.current_basis else unit_progress.current_basis end,
					visibility = case
						when excluded.last_seen_at >= unit_progress.last_seen_at
							then excluded.visibility else unit_progress.visibility end,
					deleted_at = case
						when excluded.last_seen_at >= unit_progress.last_seen_at
							then excluded.deleted_at else unit_progress.deleted_at end,
					created_at = least(unit_progress.created_at, excluded.created_at),
					updated_at = greatest(unit_progress.updated_at, excluded.updated_at)
				returning 1
			), deleted as (
				delete from unit_progress as progress
				using batch
				where progress.profile_id = batch.profile_id
					and progress.unit_id = ${input.sourceUnitId}::uuid
				returning 1
			)
			select cardinality(array(select 1 from deleted)) as processed,
				exists(
					select 1 from unit_progress where unit_id = ${input.sourceUnitId}::uuid
				) as remaining
		`,
	);
}

async function derivedStateBatch(
	tx: DatabaseTransaction,
	input: UnitMergePhaseInput,
): Promise<UnitMergePhaseResult> {
	return runBatch(
		tx,
		sql`
			with exclusion_batch as materialized (
				select profile_id, created_at
				from recommendation_exclusion
				where unit_id = ${input.sourceUnitId}::uuid
				order by profile_id
				limit ${input.batchSize}
				for update skip locked
			), copied_exclusions as (
				insert into recommendation_exclusion (profile_id, unit_id, created_at)
				select profile_id, ${input.targetUnitId}::uuid, created_at
				from exclusion_batch
				on conflict (profile_id, unit_id) do update
				set created_at = least(recommendation_exclusion.created_at, excluded.created_at)
				returning 1
			), deleted_exclusions as (
				delete from recommendation_exclusion as exclusion
				using exclusion_batch
				where exclusion.profile_id = exclusion_batch.profile_id
					and exclusion.unit_id = ${input.sourceUnitId}::uuid
				returning 1
			), visit_batch as materialized (
				select profile_id, last_visited_at
				from studio_resource_visit
				where resource_unit_id = ${input.sourceUnitId}::uuid
				order by profile_id
				limit ${input.batchSize}
				for update skip locked
			), copied_visits as (
				insert into studio_resource_visit (profile_id, resource_unit_id, last_visited_at)
				select profile_id, ${input.targetUnitId}::uuid, last_visited_at from visit_batch
				on conflict (profile_id, resource_unit_id) do update
				set last_visited_at = greatest(
					studio_resource_visit.last_visited_at,
					excluded.last_visited_at
				)
				returning 1
			), deleted_visits as (
				delete from studio_resource_visit as visit
				using visit_batch
				where visit.profile_id = visit_batch.profile_id
					and visit.resource_unit_id = ${input.sourceUnitId}::uuid
				returning 1
			), participation_batch as materialized (
				select
					profile_id,
					created_resource_at,
					first_contributed_at,
					last_contributed_at,
					contribution_count,
					last_participated_at,
					projection_updated_at
				from profile_resource_participation
				where resource_unit_id = ${input.sourceUnitId}::uuid
				order by profile_id
				limit ${input.batchSize}
				for update skip locked
			), copied_participation as (
				insert into profile_resource_participation (
					profile_id,
					resource_unit_id,
					created_resource_at,
					first_contributed_at,
					last_contributed_at,
					contribution_count,
					last_participated_at,
					projection_updated_at
				)
				select
					profile_id,
					${input.targetUnitId}::uuid,
					created_resource_at,
					first_contributed_at,
					last_contributed_at,
					contribution_count,
					last_participated_at,
					projection_updated_at
				from participation_batch
				on conflict (profile_id, resource_unit_id) do update set
					created_resource_at = least(
						profile_resource_participation.created_resource_at,
						excluded.created_resource_at
					),
					first_contributed_at = least(
						profile_resource_participation.first_contributed_at,
						excluded.first_contributed_at
					),
					last_contributed_at = greatest(
						profile_resource_participation.last_contributed_at,
						excluded.last_contributed_at
					),
					contribution_count =
						profile_resource_participation.contribution_count + excluded.contribution_count,
					last_participated_at = greatest(
						profile_resource_participation.last_participated_at,
						excluded.last_participated_at
					),
					projection_updated_at = greatest(
						profile_resource_participation.projection_updated_at,
						excluded.projection_updated_at
					)
				returning 1
			), deleted_participation as (
				delete from profile_resource_participation as participation
				using participation_batch
				where participation.profile_id = participation_batch.profile_id
					and participation.resource_unit_id = ${input.sourceUnitId}::uuid
				returning 1
			), profile_candidate_batch as materialized (
				select profile_id
				from studio_profile_editor_candidate
				where unit_id = ${input.sourceUnitId}::uuid
				order by profile_id
				limit ${input.batchSize}
				for update skip locked
			), deleted_profile_candidates as (
				delete from studio_profile_editor_candidate as candidate
				using profile_candidate_batch
				where candidate.profile_id = profile_candidate_batch.profile_id
					and candidate.unit_id = ${input.sourceUnitId}::uuid
				returning 1
			), realm_candidate_batch as materialized (
				select realm_id, realm_relation
				from studio_realm_editor_candidate
				where unit_id = ${input.sourceUnitId}::uuid
				order by realm_id, realm_relation
				limit ${input.batchSize}
				for update skip locked
			), deleted_realm_candidates as (
				delete from studio_realm_editor_candidate as candidate
				using realm_candidate_batch
				where candidate.realm_id = realm_candidate_batch.realm_id
					and candidate.realm_relation = realm_candidate_batch.realm_relation
					and candidate.unit_id = ${input.sourceUnitId}::uuid
				returning 1
			), score_batch as materialized (
				select snapshot_id, unit_id
				from unit_best_score
				where unit_id = ${input.sourceUnitId}::uuid
				order by snapshot_id
				limit ${input.batchSize}
				for update skip locked
			), deleted_scores as (
				delete from unit_best_score as score
				using score_batch
				where score.snapshot_id = score_batch.snapshot_id
					and score.unit_id = score_batch.unit_id
				returning 1
			), deleted_search as (
				delete from unit_search_document
				where unit_id = ${input.sourceUnitId}::uuid
				returning 1
			)
			select (
				cardinality(array(select 1 from deleted_exclusions)) +
				cardinality(array(select 1 from deleted_visits)) +
				cardinality(array(select 1 from deleted_participation)) +
				cardinality(array(select 1 from deleted_profile_candidates)) +
				cardinality(array(select 1 from deleted_realm_candidates)) +
				cardinality(array(select 1 from deleted_scores)) +
				cardinality(array(select 1 from deleted_search))
			)::int as processed,
			(
				exists(select 1 from recommendation_exclusion where unit_id = ${input.sourceUnitId}::uuid)
				or exists(select 1 from studio_resource_visit where resource_unit_id = ${input.sourceUnitId}::uuid)
				or exists(
					select 1 from profile_resource_participation
					where resource_unit_id = ${input.sourceUnitId}::uuid
				)
				or exists(
					select 1 from studio_profile_editor_candidate
					where unit_id = ${input.sourceUnitId}::uuid
				)
				or exists(
					select 1 from studio_realm_editor_candidate
					where unit_id = ${input.sourceUnitId}::uuid
				)
				or exists(select 1 from unit_best_score where unit_id = ${input.sourceUnitId}::uuid)
			) as remaining
		`,
	);
}

const FinalConvergencePhases = [
	"slug_addresses",
	"slug_scopes",
	"aliases",
	"external_links",
	"external_link_sources",
	"software_requirements",
	"software_requirement_platforms",
	"unit_reactions",
	"unit_shares",
	"unit_follows",
	"scores",
	"collection_items",
	"unit_tags",
	"realm_tag_judgments",
	"profile_unit_tags",
	"realm_pins",
	"realm_units",
	"realm_unit_tags",
	"post_subjects",
	"association_proposal_sources",
	"association_proposal_targets",
	"credit_sources",
	"credit_targets",
	"subject_sources",
	"subject_entities",
	"entity_measurement_entities",
	"entity_measurement_contexts",
	"release_parents",
	"series_releases",
	"poll_options",
	"content_nodes_content",
	"content_nodes_target",
	"structure_applications",
	"progress_entries",
	"progress_snapshots",
	"notification_subjects",
	"derived_state",
] as const satisfies readonly UnitMergeOperationPhase[];

async function finalizeConvergenceBatch(
	tx: DatabaseTransaction,
	input: UnitMergePhaseInput,
): Promise<UnitMergePhaseResult> {
	// The row lock waits for pre-acceptance foreign-key writers. Each subsequent
	// statement then observes their committed rows under READ COMMITTED.
	await tx.execute(sql`
		select id from unit where id = ${input.sourceUnitId}::uuid for update
	`);
	for (const phase of FinalConvergencePhases) {
		const result = await processUnitMergePhase(tx, phase, input);
		if (!result.done || result.processedRows > 0)
			return { processedRows: result.processedRows, done: false };
	}
	return { processedRows: 0, done: true };
}

export async function processUnitMergePhase(
	tx: DatabaseTransaction,
	phase: UnitMergeOperationPhase,
	input: UnitMergePhaseInput,
): Promise<UnitMergePhaseResult> {
	switch (phase) {
		case "entity_measurement_preflight":
			return processEntityMeasurementPreflightBatch(tx, input);
		case "variant_graph":
			return variantGraphBatch(tx, input);
		case "slug_addresses":
			return slugAddressBatch(tx, input);
		case "slug_scopes":
			return slugScopeBatch(tx, input);
		case "aliases":
			return aliasBatch(tx, input);
		case "external_links":
			return externalLinkBatch(tx, input);
		case "external_link_sources":
			return externalLinkSourceBatch(tx, input);
		case "software_requirements":
			return softwareRequirementBatch(tx, input);
		case "software_requirement_platforms":
			return softwareRequirementPlatformBatch(tx, input);
		case "unit_reactions":
			return reactionBatch(tx, input);
		case "unit_shares":
			return shareBatch(tx, input);
		case "unit_follows":
			return followBatch(tx, input);
		case "scores":
			return scoreBatch(tx, input);
		case "collection_items":
			return collectionItemBatch(tx, input);
		case "unit_tags":
			return unitTagBatch(tx, input);
		case "realm_tag_judgments":
			return realmTagJudgmentBatch(tx, input);
		case "profile_unit_tags":
			return profileUnitTagBatch(tx, input);
		case "realm_pins":
			return realmPinBatch(tx, input);
		case "realm_units":
			return realmUnitBatch(tx, input);
		case "realm_unit_tags":
			return realmUnitTagBatch(tx, input);
		case "post_subjects":
			return simpleReferenceBatch(tx, input, {
				table: "post",
				idColumn: "id",
				unitColumn: "subject_unit_id",
			});
		case "association_proposal_sources":
			return associationProposalBatch(tx, input, "source_unit_id");
		case "association_proposal_targets":
			return associationProposalBatch(tx, input, "target_unit_id");
		case "credit_sources":
			return creditBatch(tx, input, "source_unit_id");
		case "credit_targets":
			return creditBatch(tx, input, "credited_unit_id");
		case "subject_sources":
			return subjectAssociationBatch(tx, input, "unit_id");
		case "subject_entities":
			return subjectAssociationBatch(tx, input, "entity_id");
		case "entity_measurement_entities":
			return processEntityMeasurementMergeBatch(tx, input, "entity_id");
		case "entity_measurement_contexts":
			return processEntityMeasurementMergeBatch(tx, input, "context_unit_id");
		case "release_parents":
			return releaseParentBatch(tx, input);
		case "series_releases":
			return seriesReleaseBatch(tx, input);
		case "poll_options":
			return simpleReferenceBatch(tx, input, {
				table: "poll_option",
				idColumn: "id",
				unitColumn: "target_unit_id",
			});
		case "content_nodes_content":
			return simpleReferenceBatch(tx, input, {
				table: "content_structure_node",
				idColumn: "id",
				unitColumn: "content_unit_id",
			});
		case "content_nodes_target":
			return simpleReferenceBatch(tx, input, {
				table: "content_structure_node",
				idColumn: "id",
				unitColumn: "target_unit_id",
			});
		case "structure_members":
		case "structure_edges_parent":
		case "structure_edges_child":
			// Released Structures only admit Tag members; merge policy v1 excludes Tag Units.
			return { processedRows: 0, done: true };
		case "structure_applications":
			return structureApplicationBatch(tx, input);
		case "progress_entries":
			return progressEntryBatch(tx, input);
		case "progress_snapshots":
			return progressSnapshotBatch(tx, input);
		case "notification_subjects":
			return simpleReferenceBatch(tx, input, {
				table: "notification",
				idColumn: "id",
				unitColumn: "subject_unit_id",
			});
		case "derived_state":
			return derivedStateBatch(tx, input);
		case "finalize":
			return finalizeConvergenceBatch(tx, input);
	}
}
