import { and, eq, isNull, or, sql } from "drizzle-orm";

import { database, type DatabaseTransaction } from "../../database";
import { entity, entityAssociationPolicy, unit, unitAccessBinding } from "../../database/schema";
import {
	EntityAssociationRestricted,
	EntityEntryNotFound,
	EntityOwnershipRequired,
} from "../../entities/errors";
import type { PlatformAuthorization } from "../platform/authorization";
import {
	associationPolicyAllows,
	resolveEntityAssociationPolicy,
	type EntityAssociationActorKind,
	type EntityAssociationKind,
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

async function hasActiveOwner(
	executor: typeof database | DatabaseTransaction,
	entityId: string,
	profileId: string,
): Promise<boolean> {
	const [record] = await executor
		.select({ id: unitAccessBinding.id })
		.from(unitAccessBinding)
		.where(
			and(
				eq(unitAccessBinding.unitId, entityId),
				eq(unitAccessBinding.subjectKind, "profile"),
				eq(unitAccessBinding.profileId, profileId),
				eq(unitAccessBinding.role, "owner"),
				isNull(unitAccessBinding.revokedAt),
				or(
					isNull(unitAccessBinding.expiresAt),
					sql`${unitAccessBinding.expiresAt} > now()`,
				),
			),
		)
		.limit(1);
	return Boolean(record);
}

export class EntityAuthorization<ProfileId extends string | undefined> {
	constructor(
		readonly profileId: ProfileId,
		private readonly platform: PlatformAuthorization<ProfileId>,
	) {}

	async getAssociationPolicy(entityId: string) {
		return getEntityAssociationPolicy(entityId);
	}

	async ensureCanManageAssociationPolicy(
		this: EntityAuthorization<string>,
		tx: DatabaseTransaction,
		entityId: string,
	): Promise<void> {
		await lockEntityAssociationState(tx, entityId);
		if (!(await entityExists(tx, entityId))) throw new EntityEntryNotFound();
		if (await this.platform.hasCapability("entity.association-policy.manage")) return;
		if (await hasActiveOwner(tx, entityId, this.profileId)) return;
		throw new EntityOwnershipRequired();
	}

	private async ensureAssociationAllowedForExistingEntity(
		this: EntityAuthorization<string>,
		tx: DatabaseTransaction,
		entityId: string,
		kind: EntityAssociationKind,
	): Promise<void> {
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
		const mode = row?.mode ?? "open";
		let actor: EntityAssociationActorKind = "community";
		if (await this.platform.hasCapability("entity.associations.override")) {
			actor = "platform";
		} else if (await hasActiveOwner(tx, entityId, this.profileId)) {
			actor = "owner";
		}
		if (!associationPolicyAllows(mode, actor))
			throw new EntityAssociationRestricted(kind, mode);
	}

	async ensureAssociationAllowed(
		this: EntityAuthorization<string>,
		tx: DatabaseTransaction,
		entityId: string,
		kind: EntityAssociationKind,
	): Promise<void> {
		await lockEntityAssociationState(tx, entityId);
		if (!(await entityExists(tx, entityId))) throw new EntityEntryNotFound();
		await this.ensureAssociationAllowedForExistingEntity(tx, entityId, kind);
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
		await this.ensureAssociationAllowedForExistingEntity(tx, targetUnitId, "subject");
	}
}
