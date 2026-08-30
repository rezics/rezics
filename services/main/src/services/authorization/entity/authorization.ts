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

	async allowsAssociationCommand(
		this: EntityAuthorization<string>,
		tx: DatabaseTransaction,
		entityId: string,
		kind: AssociationKind,
		command: EntityAssociationCommand,
	): Promise<boolean> {
		await lockEntityAssociationState(tx, entityId);
		if (!(await entityExists(tx, entityId))) throw new EntityEntryNotFound();
		try {
			await this.ensureAssociationCommandAllowedForExistingEntity(tx, entityId, kind, command);
			return true;
		} catch (error) {
			if (error instanceof EntityAssociationRestricted) return false;
			throw error;
		}
	}

	async ensureAssociationAllowed(
		this: EntityAuthorization<string>,
		tx: DatabaseTransaction,
		entityId: string,
		kind: AssociationKind,
	): Promise<void> {
		if (!(await this.allowsAssociationCommand(tx, entityId, kind, "direct")))
			throw new EntityAssociationRestricted(kind, "direct");
	}

	async ensureAssociationRequestAllowed(
		this: EntityAuthorization<string>,
		tx: DatabaseTransaction,
		entityId: string,
		kind: AssociationKind,
	): Promise<void> {
		if (!(await this.allowsAssociationCommand(tx, entityId, kind, "request")))
			throw new EntityAssociationRestricted(kind, "request");
	}

	async ensureAssociationInvitationAllowed(
		this: EntityAuthorization<string>,
		tx: DatabaseTransaction,
		entityId: string,
		kind: AssociationKind,
	): Promise<void> {
		if (!(await this.allowsAssociationCommand(tx, entityId, kind, "invitation")))
			throw new EntityAssociationRestricted(kind, "invitation");
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
