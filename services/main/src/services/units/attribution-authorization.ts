import { and, eq, isNull, ne, sql } from "drizzle-orm";

import type { Authorization } from "../authorization";
import { associationTargetScope } from "../authorization/unit/scope";
import type { DatabaseTransaction } from "../database";
import { entity, unit } from "../database/schema";
import { UnitNotFound } from "./errors";

async function isEntityTarget(tx: DatabaseTransaction, targetUnitId: string): Promise<boolean> {
	const [record] = await tx
		.select({ id: unit.id, entityId: entity.id })
		.from(unit)
		.leftJoin(entity, eq(entity.id, unit.id))
		.where(
			and(
				eq(unit.id, targetUnitId),
				eq(unit.status, "published"),
				ne(unit.visibility, "private"),
				eq(unit.moderationStatus, "approved"),
				isNull(unit.deletedAt),
			),
		)
		.limit(1);
	if (!record) throw new UnitNotFound();
	return record.entityId !== null;
}

async function lockAttributionTarget(tx: DatabaseTransaction, targetUnitId: string): Promise<void> {
	await tx.execute(
		sql`select pg_advisory_xact_lock(hashtextextended(${`unit-attribution:${targetUnitId}`}::text, 0))`,
	);
}

/** Direct attribution is open for an Entity only when its policy permits it. */
export async function ensureDirectCreditAttributionAllowed(
	authorization: Authorization<string>,
	tx: DatabaseTransaction,
	targetUnitId: string,
): Promise<void> {
	await lockAttributionTarget(tx, targetUnitId);
	if (await isEntityTarget(tx, targetUnitId)) {
		await authorization.entity.ensureAssociationAllowed(tx, targetUnitId, "credit");
		return;
	}
	await authorization.unit.ensureInTransaction(
		tx,
		targetUnitId,
		"unit.association.manage",
		associationTargetScope("credit"),
	);
}

/** A request is safe for any existing Unit because it has no effect before target consent. */
export async function ensureCreditAttributionRequestAllowed(
	authorization: Authorization<string>,
	tx: DatabaseTransaction,
	targetUnitId: string,
): Promise<void> {
	await lockAttributionTarget(tx, targetUnitId);
	if (await isEntityTarget(tx, targetUnitId))
		await authorization.entity.ensureAssociationRequestAllowed(tx, targetUnitId, "credit");
}

/** Invitations must be initiated by a manager of the credited Unit. */
export async function ensureCreditAttributionInvitationAllowed(
	authorization: Authorization<string>,
	tx: DatabaseTransaction,
	targetUnitId: string,
): Promise<void> {
	await lockAttributionTarget(tx, targetUnitId);
	if (await isEntityTarget(tx, targetUnitId)) {
		await authorization.entity.ensureAssociationInvitationAllowed(tx, targetUnitId, "credit");
		return;
	}
	await authorization.unit.ensureInTransaction(
		tx,
		targetUnitId,
		"unit.association.manage",
		associationTargetScope("credit"),
	);
}
