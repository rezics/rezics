import { and, eq, isNull, sql } from "drizzle-orm";

import { database, type DatabaseTransaction } from "../../database";
import { entity, unit } from "../../database/schema";
import { EntityAssociationRestricted, EntityEntryNotFound } from "../../entities/errors";
import type { PlatformAuthorization } from "../platform/authorization";
import type { UnitAuthorization } from "../unit/authorization";
import { associationTargetScope } from "../unit/scope";
import {
	entityAssociationPermission,
	type AssociationKind,
	type EntityAssociationCommand,
} from "./policy";

export async function lockEntityAssociationState(
	tx: DatabaseTransaction,
	entityId: string,
): Promise<void> {
	await tx.execute(
		sql`select pg_advisory_xact_lock(hashtextextended(${`entity-association:${entityId}`}::text, 0))`,
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

	private async ensureAssociationCommandAllowedForExistingEntity(
		this: EntityAuthorization<string>,
		tx: DatabaseTransaction,
		entityId: string,
		kind: AssociationKind,
		command: EntityAssociationCommand,
	): Promise<void> {
		if (await this.platform.hasCapability("entity.associations.override", tx)) return;

		const managerDecision = await this.unitAuthorization.decideInTransaction(
			tx,
			entityId,
			"unit.association.manage",
			associationTargetScope(kind),
		);
		if (managerDecision.allowed) return;
		if (command !== "invitation") {
			const decision = await this.unitAuthorization.decideInTransaction(
				tx,
				entityId,
				entityAssociationPermission(kind, command),
				associationTargetScope(kind),
			);
			if (decision.allowed) return;
		}
		throw new EntityAssociationRestricted(kind, command);
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
