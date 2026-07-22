import { and, eq, isNull, sql } from "drizzle-orm";

import { database, type DatabaseTransaction } from "../../database";
import { entity, entityAssociationPolicy, unit } from "../../database/schema";
import { EntityAssociationRestricted, EntityEntryNotFound } from "../../entities/errors";
import type { PlatformAuthorization } from "../platform/authorization";
import type { UnitAuthorization } from "../unit/authorization";
import { associationTargetScope } from "../unit/scope";
import {
	resolveEntityAssociationPolicy,
	resolveEntityAssociationAdmission,
	type EntityAssociationCommand,
	type AssociationKind,
	type EntityAssociationPolicyMode,
} from "./policy";

export async function lockEntityAssociationState(
	tx: DatabaseTransaction,
	entityId: string,
): Promise<void> {
	await tx.execute(
		sql`select pg_advisory_xact_lock(hashtextextended(${`entity-association:${entityId}`}::text, 0))`,
	);
}

export async function getEntityAssociationPolicy(entityId: string) {
	if (!(await entityExists(database, entityId))) throw new EntityEntryNotFound();
	return resolveEntityAssociationPolicy(
		await database
			.select({
				kind: entityAssociationPolicy.kind,
				mode: entityAssociationPolicy.mode,
			})
			.from(entityAssociationPolicy)
			.where(eq(entityAssociationPolicy.entityId, entityId)),
	);
}

async function entityExists(
	executor: typeof database | DatabaseTransaction,
	entityId: string,
): Promise<boolean> {
	const [record] = await executor
		.select({ id: entity.id })
		.from(entity)
		.innerJoin(unit, eq(unit.id, entity.id))
		.where(and(eq(entity.id, entityId), isNull(unit.deletedAt)))
		.limit(1);
	return Boolean(record);
}

export class EntityAuthorization<ProfileId extends string | undefined> {
	constructor(
		readonly profileId: ProfileId,
		private readonly platform: PlatformAuthorization<ProfileId>,
		private readonly unitAuthorization: UnitAuthorization<ProfileId>,
	) {}

	async getAssociationPolicy(entityId: string) {
		return getEntityAssociationPolicy(entityId);
	}

	async ensureCanManageAssociationPolicy(
		this: EntityAuthorization<string>,
		tx: DatabaseTransaction,
		entityId: string,
		kinds: readonly AssociationKind[],
	): Promise<void> {
		await lockEntityAssociationState(tx, entityId);
		if (!(await entityExists(tx, entityId))) throw new EntityEntryNotFound();
		for (const kind of kinds)
			await this.unitAuthorization.ensureInTransaction(
				tx,
				entityId,
				"unit.association.manage",
				associationTargetScope(kind),
			);
	}

	private async associationMode(
		tx: DatabaseTransaction,
		entityId: string,
		kind: AssociationKind,
	): Promise<EntityAssociationPolicyMode> {
		const [row] = await tx
			.select({ mode: entityAssociationPolicy.mode })
			.from(entityAssociationPolicy)
			.where(
				and(
					eq(entityAssociationPolicy.entityId, entityId),
					eq(entityAssociationPolicy.kind, kind),
				),
			)
			.limit(1);
		return row?.mode ?? "open";
	}

	private async ensureAssociationCommandAllowedForExistingEntity(
		this: EntityAuthorization<string>,
		tx: DatabaseTransaction,
		entityId: string,
		kind: AssociationKind,
		command: EntityAssociationCommand,
	): Promise<void> {
		// A PostgreSQL transaction is pinned to one client. Keep its queries
		// sequential instead of relying on node-postgres' deprecated query queue.
		const mode = await this.associationMode(tx, entityId, kind);
		const platformOverride = await this.platform.hasCapability(
			"entity.associations.override",
			tx,
		);
		const targetDecision = await this.unitAuthorization.decideInTransaction(
			tx,
			entityId,
			"unit.association.manage",
			associationTargetScope(kind),
		);
		if (
			resolveEntityAssociationAdmission({
				mode,
				command,
				targetManager: targetDecision.allowed,
				platformOverride,
			}).kind === "forbidden"
		)
			throw new EntityAssociationRestricted(kind, mode);
	}

	async ensureAssociationAllowed(
		this: EntityAuthorization<string>,
		tx: DatabaseTransaction,
		entityId: string,
		kind: AssociationKind,
	): Promise<void> {
		await lockEntityAssociationState(tx, entityId);
		if (!(await entityExists(tx, entityId))) throw new EntityEntryNotFound();
		await this.ensureAssociationCommandAllowedForExistingEntity(tx, entityId, kind, "direct");
	}

	async ensureAssociationRequestAllowed(
		this: EntityAuthorization<string>,
		tx: DatabaseTransaction,
		entityId: string,
		kind: AssociationKind,
	): Promise<void> {
		await lockEntityAssociationState(tx, entityId);
		if (!(await entityExists(tx, entityId))) throw new EntityEntryNotFound();
		await this.ensureAssociationCommandAllowedForExistingEntity(tx, entityId, kind, "request");
	}

	async ensureAssociationInvitationAllowed(
		this: EntityAuthorization<string>,
		tx: DatabaseTransaction,
		entityId: string,
		kind: AssociationKind,
	): Promise<void> {
		await lockEntityAssociationState(tx, entityId);
		if (!(await entityExists(tx, entityId))) throw new EntityEntryNotFound();
		const platformOverride = await this.platform.hasCapability(
			"entity.associations.override",
			tx,
		);
		if (!platformOverride)
			await this.unitAuthorization.ensureInTransaction(
				tx,
				entityId,
				"unit.association.manage",
				associationTargetScope(kind),
			);
		await this.ensureAssociationCommandAllowedForExistingEntity(
			tx,
			entityId,
			kind,
			"invitation",
		);
	}

	async ensureSubjectAssociationAllowedIfEntity(
		this: EntityAuthorization<string>,
		tx: DatabaseTransaction,
		targetUnitId: string,
	): Promise<void> {
		await lockEntityAssociationState(tx, targetUnitId);
		const [record] = await tx
			.select({ deletedAt: unit.deletedAt })
			.from(entity)
			.innerJoin(unit, eq(unit.id, entity.id))
			.where(eq(entity.id, targetUnitId))
			.limit(1);
		if (!record) return;
		if (record.deletedAt) throw new EntityEntryNotFound();
		await this.ensureAssociationCommandAllowedForExistingEntity(
			tx,
			targetUnitId,
			"subject",
			"direct",
		);
	}
}
