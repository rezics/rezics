import { and, eq, isNull, sql } from "drizzle-orm";

import type { UnitScope } from "../authorization/unit/scope";
import { database, type DatabaseExecutor, type DatabaseTransaction } from "../database";
import {
	contentStructure,
	contentStructureNode,
	profileResourceParticipation,
	unitDock,
} from "../database/schema";

type ParticipationTarget =
	| { readonly kind: "unit_creation"; readonly unitId: string }
	| {
			readonly kind: "unit_contribution";
			readonly unitId: string;
			/** Preserved for command-call-site proof; participation itself is not access state. */
			readonly authorizationScope: UnitScope | null;
	  }
	| { readonly kind: "content_structure"; readonly structureId: string }
	| { readonly kind: "dock"; readonly dockId: string };

type RecordParticipationInput = {
	readonly profileId: string | null | undefined;
	readonly relation: "created" | "contributed";
	readonly occurredAt: Date;
	readonly target: ParticipationTarget;
};

export const ParticipationResourceFanoutLimit = 32;

export class ParticipationResourceFanoutExceeded extends Error {
	readonly unitId: string;
	readonly limit: number;

	constructor(unitId: string, limit = ParticipationResourceFanoutLimit) {
		super(`Participation Unit ${unitId} belongs to more than ${limit} current resources`);
		this.name = "ParticipationResourceFanoutExceeded";
		this.unitId = unitId;
		this.limit = limit;
	}
}

/** Resolves a content Unit to every current top-level public-edit resource that contains it. */
export async function resolveParticipationResourceUnitIds(
	executor: DatabaseExecutor,
	unitId: string,
): Promise<string[]> {
	const bookOwners = await executor
		.select({ unitId: contentStructure.ownerUnitId })
		.from(contentStructureNode)
		.innerJoin(
			contentStructure,
			and(
				eq(contentStructure.id, contentStructureNode.structureId),
				eq(contentStructure.ownerUnitId, contentStructureNode.ownerUnitId),
			),
		)
		.where(
			and(
				eq(contentStructureNode.contentUnitId, unitId),
				isNull(contentStructureNode.deletedAt),
				eq(contentStructure.kind, "book.contents"),
				isNull(contentStructure.deletedAt),
			),
		)
		.groupBy(contentStructure.ownerUnitId)
		.orderBy(contentStructure.ownerUnitId)
		.limit(ParticipationResourceFanoutLimit + 1);
	if (bookOwners.length > ParticipationResourceFanoutLimit)
		throw new ParticipationResourceFanoutExceeded(unitId);
	return bookOwners.length ? bookOwners.map(({ unitId: ownerUnitId }) => ownerUnitId) : [unitId];
}

async function resolveParticipationTargets(
	tx: DatabaseTransaction,
	target: ParticipationTarget,
): Promise<string[]> {
	switch (target.kind) {
		case "unit_creation":
			return [target.unitId];
		case "unit_contribution":
			return resolveParticipationResourceUnitIds(tx, target.unitId);
		case "content_structure": {
			const [record] = await tx
				.select({ ownerUnitId: contentStructure.ownerUnitId })
				.from(contentStructure)
				.where(eq(contentStructure.id, target.structureId))
				.limit(1);
			if (!record)
				throw new Error(`Participation Content Structure ${target.structureId} does not exist`);
			return [record.ownerUnitId];
		}
		case "dock": {
			const [record] = await tx
				.select({ unitId: unitDock.unitId })
				.from(unitDock)
				.where(eq(unitDock.id, target.dockId))
				.limit(1);
			if (!record) throw new Error(`Participation Dock ${target.dockId} does not exist`);
			return [record.unitId];
		}
	}
}

/**
 * Updates the History-owned participation summary in the caller's transaction.
 *
 * Contention is limited to at most `ParticipationResourceFanoutLimit`
 * `(profile, resource)` rows in one multi-row UPSERT. There is no corpus-wide
 * advisory lock on ordinary revision writes.
 */
export async function recordProfileResourceParticipation(
	tx: DatabaseTransaction,
	input: RecordParticipationInput,
): Promise<void> {
	const profileId = input.profileId;
	if (!profileId) return;
	const resourceUnitIds = await resolveParticipationTargets(tx, input.target);
	if (input.relation === "created") {
		await tx
			.insert(profileResourceParticipation)
			.values(
				resourceUnitIds.map((resourceUnitId) => ({
					profileId,
					resourceUnitId,
					createdResourceAt: input.occurredAt,
					contributionCount: 0,
					lastParticipatedAt: input.occurredAt,
				})),
			)
			.onConflictDoUpdate({
				target: [
					profileResourceParticipation.profileId,
					profileResourceParticipation.resourceUnitId,
				],
				set: {
					createdResourceAt: sql`least(
						${profileResourceParticipation.createdResourceAt},
						excluded.created_resource_at
					)`,
					lastParticipatedAt: sql`greatest(
						${profileResourceParticipation.lastParticipatedAt},
						excluded.last_participated_at
					)`,
					projectionUpdatedAt: new Date(),
				},
			});
		return;
	}

	await tx
		.insert(profileResourceParticipation)
		.values(
			resourceUnitIds.map((resourceUnitId) => ({
				profileId,
				resourceUnitId,
				firstContributedAt: input.occurredAt,
				lastContributedAt: input.occurredAt,
				contributionCount: 1,
				lastParticipatedAt: input.occurredAt,
			})),
		)
		.onConflictDoUpdate({
			target: [profileResourceParticipation.profileId, profileResourceParticipation.resourceUnitId],
			set: {
				firstContributedAt: sql`least(
					${profileResourceParticipation.firstContributedAt},
					excluded.first_contributed_at
				)`,
				lastContributedAt: sql`greatest(
					${profileResourceParticipation.lastContributedAt},
					excluded.last_contributed_at
				)`,
				contributionCount: sql`${profileResourceParticipation.contributionCount} + 1`,
				lastParticipatedAt: sql`greatest(
					${profileResourceParticipation.lastParticipatedAt},
					excluded.last_participated_at
				)`,
				projectionUpdatedAt: new Date(),
			},
		});
}

/**
 * Maintenance-only full rebuild from immutable history ledgers.
 *
 * A NOWAIT share lock on every source ledger proves that no transaction has
 * inserted an event whose projection UPSERT is still pending. Once acquired,
 * the locks hold later writers before their ledger insert until the rebuild
 * commits. Operators should pause writers first: under normal traffic this is
 * intentionally allowed to fail instead of producing a double-counted cut.
 */
export async function rebuildProfileResourceParticipation(): Promise<void> {
	await database.transaction(async (tx) => {
		await tx.execute(sql`set local statement_timeout = 0`);
		await tx.execute(sql`
			lock table
				unit_status_event,
				unit_revision,
				content_structure_revision,
				collection_structure_revision,
				dock_revision
			in share mode nowait
		`);
		const excessiveFanout = await tx.execute<{ readonly contentUnitId: string }>(sql`
			with current_excessive as (
				select node.content_unit_id
				from content_structure_node node
				join content_structure structure
					on structure.id = node.structure_id
					and structure.owner_unit_id = node.owner_unit_id
				where node.deleted_at is null
					and structure.kind = 'book.contents'
					and structure.deleted_at is null
				group by node.content_unit_id
				having count(distinct structure.owner_unit_id) > ${ParticipationResourceFanoutLimit}
				limit 1
			), historical_excessive as (
				select revision.unit_id as content_unit_id
				from unit_revision revision
				join content_structure_node node
					on node.content_unit_id = revision.unit_id
					and node.created_at <= revision.created_at
					and (node.deleted_at is null or node.deleted_at > revision.created_at)
				join content_structure structure
					on structure.id = node.structure_id
					and structure.owner_unit_id = node.owner_unit_id
					and structure.kind = 'book.contents'
					and structure.created_at <= revision.created_at
					and (structure.deleted_at is null or structure.deleted_at > revision.created_at)
				where revision.actor_profile_id is not null
					and not exists (
						select 1
						from unit_status_event initial_event
						where initial_event.unit_id = revision.unit_id
							and initial_event.from_status is null
							and initial_event.revision_id = revision.id
					)
				group by revision.id, revision.unit_id
				having count(distinct structure.owner_unit_id) > ${ParticipationResourceFanoutLimit}
				limit 1
			)
			select content_unit_id as "contentUnitId" from current_excessive
			union all
			select content_unit_id from historical_excessive
			limit 1
		`);
		const excessiveUnitId = excessiveFanout.rows[0]?.contentUnitId;
		if (excessiveUnitId) throw new ParticipationResourceFanoutExceeded(excessiveUnitId);
		await tx.execute(sql`lock table profile_resource_participation in access exclusive mode`);
		await tx.delete(profileResourceParticipation);
		await tx.execute(sql`
			with participation_event as (
				select
					event.changed_by_profile_id as profile_id,
					event.unit_id as resource_unit_id,
					'created'::text as relation,
					event.created_at as occurred_at
				from unit_status_event event
				where event.from_status is null
					and event.actor_kind = 'profile'
					and event.changed_by_profile_id is not null

				union all

				select
					revision.actor_profile_id,
					coalesce(book_owner.owner_unit_id, revision.unit_id),
					'contributed',
					revision.created_at
				from unit_revision revision
				left join lateral (
					select distinct structure.owner_unit_id
					from content_structure_node node
					join content_structure structure
						on structure.id = node.structure_id
						and structure.owner_unit_id = node.owner_unit_id
					where node.content_unit_id = revision.unit_id
						and node.created_at <= revision.created_at
						and (node.deleted_at is null or node.deleted_at > revision.created_at)
						and structure.kind = 'book.contents'
						and structure.created_at <= revision.created_at
						and (structure.deleted_at is null or structure.deleted_at > revision.created_at)
				) book_owner on true
				where revision.actor_profile_id is not null
					and not exists (
						select 1
						from unit_status_event initial_event
						where initial_event.unit_id = revision.unit_id
							and initial_event.from_status is null
							and initial_event.revision_id = revision.id
					)

				union all

				select
					revision.actor_profile_id,
					structure.owner_unit_id,
					'contributed',
					revision.created_at
				from content_structure_revision revision
				join content_structure structure on structure.id = revision.structure_id
				where revision.actor_profile_id is not null

				union all

				select
					revision.actor_profile_id,
					revision.collection_id,
					'contributed',
					revision.created_at
				from collection_structure_revision revision
				where revision.actor_profile_id is not null

				union all

				select
					revision.actor_profile_id,
					dock.unit_id,
					'contributed',
					revision.created_at
				from dock_revision revision
				join unit_dock dock on dock.id = revision.dock_id
				where revision.actor_profile_id is not null
			), participation as (
				select
					profile_id,
					resource_unit_id,
					min(occurred_at) filter (where relation = 'created') as created_resource_at,
					min(occurred_at) filter (where relation = 'contributed') as first_contributed_at,
					max(occurred_at) filter (where relation = 'contributed') as last_contributed_at,
					count(*) filter (where relation = 'contributed') as contribution_count,
					max(occurred_at) as last_participated_at
				from participation_event
				group by profile_id, resource_unit_id
			)
			insert into profile_resource_participation (
				profile_id,
				resource_unit_id,
				created_resource_at,
				first_contributed_at,
				last_contributed_at,
				contribution_count,
				last_participated_at
			)
			select
				profile_id,
				resource_unit_id,
				created_resource_at,
				first_contributed_at,
				last_contributed_at,
				contribution_count,
				last_participated_at
			from participation
		`);
	});
}
