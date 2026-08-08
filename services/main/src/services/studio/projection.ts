import { and, eq, isNull, sql } from "drizzle-orm";

import { database, type DatabaseExecutor, type DatabaseTransaction } from "../database";
import {
	contentStructure,
	contentStructureNode,
	studioWorkRelation,
	unitDock,
	type StudioWorkRelation,
	type StudioWorkSource,
} from "../database/schema";
import type { UnitScope } from "../authorization/unit/scope";

type StudioWorkTarget =
	| {
			readonly kind: "unit_creation";
			readonly unitId: string;
	  }
	| {
			readonly kind: "unit_contribution";
			readonly unitId: string;
			/**
			 * Null means the historical command did not preserve its exact scope.
			 * Permission presentation must discover a currently authorized scope.
			 */
			readonly authorizationScope: UnitScope | null;
	  }
	| { readonly kind: "content_structure"; readonly structureId: string }
	| { readonly kind: "dock"; readonly dockId: string };

type RecordStudioWorkRelationInput = {
	readonly profileId: string | null | undefined;
	readonly relation: StudioWorkRelation;
	readonly source: StudioWorkSource;
	readonly occurredAt: Date;
	readonly target: StudioWorkTarget;
};

type ResolvedStudioWorkTarget = {
	readonly resourceUnitId: string;
	readonly authorizationUnitId: string;
	readonly authorizationScope: UnitScope | null;
};

async function lockStudioWorkProjection(tx: DatabaseTransaction): Promise<void> {
	await tx.execute(
		sql`select pg_advisory_xact_lock(hashtextextended(${"studio-work-relation"}::text, 0))`,
	);
}

/**
 * Resolves a child content Unit to the current top-level Studio resource.
 *
 * @internal
 */
export async function resolveStudioResourceUnitId(
	executor: DatabaseExecutor,
	unitId: string,
): Promise<string> {
	return (await resolveStudioResourceUnitIds(executor, unitId))[0] ?? unitId;
}

/**
 * Resolves every active top-level Studio resource containing a content Unit.
 *
 * @internal
 */
export async function resolveStudioResourceUnitIds(
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
		.orderBy(contentStructure.ownerUnitId);
	return bookOwners.length ? bookOwners.map(({ unitId: ownerUnitId }) => ownerUnitId) : [unitId];
}

async function resolveStudioWorkTarget(
	tx: DatabaseTransaction,
	target: StudioWorkTarget,
): Promise<ResolvedStudioWorkTarget[]> {
	switch (target.kind) {
		case "unit_creation":
			return [
				{
					resourceUnitId: target.unitId,
					authorizationUnitId: target.unitId,
					authorizationScope: null,
				},
			];
		case "unit_contribution":
			return (await resolveStudioResourceUnitIds(tx, target.unitId)).map(
				(resourceUnitId) => ({
					resourceUnitId,
					authorizationUnitId: target.unitId,
					authorizationScope: target.authorizationScope,
				}),
			);
		case "content_structure": {
			const [record] = await tx
				.select({ ownerUnitId: contentStructure.ownerUnitId })
				.from(contentStructure)
				.where(eq(contentStructure.id, target.structureId))
				.limit(1);
			if (!record)
				throw new Error(`Studio Content Structure ${target.structureId} does not exist`);
			return [
				{
					resourceUnitId: record.ownerUnitId,
					authorizationUnitId: record.ownerUnitId,
					authorizationScope: ["content-structure"],
				},
			];
		}
		case "dock": {
			const [record] = await tx
				.select({ unitId: unitDock.unitId, kind: unitDock.kind })
				.from(unitDock)
				.where(eq(unitDock.id, target.dockId))
				.limit(1);
			if (!record) throw new Error(`Studio Dock ${target.dockId} does not exist`);
			return [
				{
					resourceUnitId: record.unitId,
					authorizationUnitId: record.unitId,
					authorizationScope: ["dock", record.kind],
				},
			];
		}
	}
}

/**
 * Records rebuildable Studio relationship evidence in the caller's transaction.
 *
 * @internal
 */
export async function recordStudioWorkRelation(
	tx: DatabaseTransaction,
	input: RecordStudioWorkRelationInput,
): Promise<void> {
	if (!input.profileId) return;
	await lockStudioWorkProjection(tx);
	const targets = await resolveStudioWorkTarget(tx, input.target);
	for (const target of targets) {
		const authorizationScopeKey = target.authorizationScope?.join("/") ?? "*";
		await tx
			.insert(studioWorkRelation)
			.values({
				profileId: input.profileId,
				resourceUnitId: target.resourceUnitId,
				authorizationUnitId: target.authorizationUnitId,
				authorizationScope: target.authorizationScope
					? [...target.authorizationScope]
					: null,
				authorizationScopeKey,
				relation: input.relation,
				source: input.source,
				firstAt: input.occurredAt,
				lastAt: input.occurredAt,
				activityCount: 1,
			})
			.onConflictDoUpdate({
				target: [
					studioWorkRelation.profileId,
					studioWorkRelation.resourceUnitId,
					studioWorkRelation.authorizationUnitId,
					studioWorkRelation.authorizationScopeKey,
					studioWorkRelation.relation,
					studioWorkRelation.source,
				],
				set: {
					firstAt: sql`least(${studioWorkRelation.firstAt}, excluded.first_at)`,
					lastAt: sql`greatest(${studioWorkRelation.lastAt}, excluded.last_at)`,
					activityCount: sql`${studioWorkRelation.activityCount} + 1`,
				},
			});
	}
}

/**
 * Rebuilds the complete Studio relationship projection from immutable source ledgers.
 *
 * @internal
 */
export async function rebuildStudioWorkRelations(): Promise<void> {
	await database.transaction(async (tx) => {
		await tx.execute(sql`set local statement_timeout = 0`);
		await lockStudioWorkProjection(tx);
		await tx.delete(studioWorkRelation);
		await tx.execute(sql`
			insert into studio_work_relation (
				profile_id,
				resource_unit_id,
				authorization_unit_id,
				authorization_scope,
				authorization_scope_key,
				relation,
				source,
				first_at,
				last_at,
				activity_count
			)
			select
				event.changed_by_profile_id,
				event.unit_id,
				event.unit_id,
				null,
				'*',
				'created',
				'unit_status',
				min(event.created_at),
				max(event.created_at),
				count(*)::integer
			from unit_status_event event
			where event.from_status is null
				and event.actor_kind = 'profile'
				and event.changed_by_profile_id is not null
			group by event.changed_by_profile_id, event.unit_id
		`);
		await tx.execute(sql`
			insert into studio_work_relation (
				profile_id,
				resource_unit_id,
				authorization_unit_id,
				authorization_scope,
				authorization_scope_key,
				relation,
				source,
				first_at,
				last_at,
				activity_count
			)
			select
				revision.actor_profile_id,
				coalesce(book_owner.owner_unit_id, revision.unit_id),
				revision.unit_id,
				null,
				'*',
				'contributed',
				'unit_revision',
				min(revision.created_at),
				max(revision.created_at),
				count(*)::integer
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
					and (
						structure.deleted_at is null
						or structure.deleted_at > revision.created_at
					)
			) book_owner on true
			where revision.actor_profile_id is not null
				and not exists (
					select 1
					from unit_status_event initial_event
					where initial_event.unit_id = revision.unit_id
						and initial_event.from_status is null
						and initial_event.revision_id = revision.id
				)
			group by
				revision.actor_profile_id,
				coalesce(book_owner.owner_unit_id, revision.unit_id),
				revision.unit_id
		`);
		await tx.execute(sql`
			insert into studio_work_relation (
				profile_id,
				resource_unit_id,
				authorization_unit_id,
				authorization_scope,
				authorization_scope_key,
				relation,
				source,
				first_at,
				last_at,
				activity_count
			)
			select
				revision.actor_profile_id,
				structure.owner_unit_id,
				structure.owner_unit_id,
				array['content-structure']::text[],
				'content-structure',
				'contributed',
				'content_structure_revision',
				min(revision.created_at),
				max(revision.created_at),
				count(*)::integer
			from content_structure_revision revision
			join content_structure structure on structure.id = revision.structure_id
			where revision.actor_profile_id is not null
			group by revision.actor_profile_id, structure.owner_unit_id
		`);
		await tx.execute(sql`
			insert into studio_work_relation (
				profile_id,
				resource_unit_id,
				authorization_unit_id,
				authorization_scope,
				authorization_scope_key,
				relation,
				source,
				first_at,
				last_at,
				activity_count
			)
			select
				revision.actor_profile_id,
				revision.collection_id,
				revision.collection_id,
				array['collection', 'items']::text[],
				'collection/items',
				'contributed',
				'collection_structure_revision',
				min(revision.created_at),
				max(revision.created_at),
				count(*)::integer
			from collection_structure_revision revision
			where revision.actor_profile_id is not null
			group by revision.actor_profile_id, revision.collection_id
		`);
		await tx.execute(sql`
			insert into studio_work_relation (
				profile_id,
				resource_unit_id,
				authorization_unit_id,
				authorization_scope,
				authorization_scope_key,
				relation,
				source,
				first_at,
				last_at,
				activity_count
			)
			select
				revision.actor_profile_id,
				dock.unit_id,
				dock.unit_id,
				array['dock', dock.kind::text]::text[],
				'dock/' || dock.kind::text,
				'contributed',
				'dock_revision',
				min(revision.created_at),
				max(revision.created_at),
				count(*)::integer
			from dock_revision revision
			join unit_dock dock on dock.id = revision.dock_id
			where revision.actor_profile_id is not null
			group by revision.actor_profile_id, dock.unit_id, dock.kind
		`);
	});
}
