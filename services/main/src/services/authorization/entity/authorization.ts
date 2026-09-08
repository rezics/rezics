import { and, eq, isNull, sql } from "drizzle-orm";

import { database, type DatabaseTransaction } from "../../database";
import { entityIdentity } from "../../database/schema";
import { EntityAssociationRestricted, EntityEntryNotFound } from "../../entities/errors";
import type { PlatformAuthorization } from "../platform/authorization";
import type { UnitAuthorization } from "../unit/authorization";
import { requireParticipation, ParticipationDenied } from "../../participation/policy";
import type { AssociationKind, EntityAssociationCommand } from "./policy";

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
		.select({ id: entityIdentity.id })
		.from(entityIdentity)
		.where(and(eq(entityIdentity.id, entityId), isNull(entityIdentity.deletedAt)))
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
		const authority=this.unitAuthorization.participationAuthority;
		// Requesting consent has no accepted effect; a direct attribution or invitation represents the target.
		if(authority && command==="request" && (await this.unitAuthorization.readableUnitIdsInTransaction(tx,[entityId])).has(entityId)) return;
		if(authority && authority.actingEntityId===entityId) {
			try { await requireParticipation(tx,authority,"entity.publish",{owner:"entity",id:entityId}); return; }
			catch(cause) { if(!(cause instanceof ParticipationDenied)) throw cause; }
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
			.select({ deletedAt: entityIdentity.deletedAt })
			.from(entityIdentity)
			.where(eq(entityIdentity.id, targetUnitId))
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
