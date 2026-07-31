import { and, eq, isNull, ne, sql } from "drizzle-orm";

import type { Authorization } from "../authorization";
import { associationTargetScope } from "../authorization/unit/scope";
import type { DatabaseTransaction } from "../database";
import { entity, unit } from "../database/schema";
import {
	CreditAttributionRequestConfirmationRequired,
	EntityAssociationRestricted,
	EntityEntryNotFound,
} from "../entities/errors";
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

export type EntityCreditAttributionCreationMode = "direct" | "request";
export type CreditAttributionRequestConsent = "direct_only" | "allow_requests";

/**
 * Requires explicit user consent before a creation plan may send attribution requests.
 *
 * The service calls this only after resolving every target under the same transaction
 * that will create the Unit and its accepted associations.
 */
export function ensureCreditAttributionRequestsConfirmed(
	consent: CreditAttributionRequestConsent,
	attributions: readonly {
		readonly entityId: string;
		readonly creationMode: EntityCreditAttributionCreationMode;
	}[],
): void {
	if (consent === "allow_requests") return;
	const requestedEntityIds = attributions.flatMap((attribution) =>
		attribution.creationMode === "request" ? [attribution.entityId] : [],
	);
	if (requestedEntityIds.length > 0)
		throw new CreditAttributionRequestConfirmationRequired(requestedEntityIds);
}

/**
 * Resolves the consent path for crediting an Entity on a newly created work.
 *
 * Direct association and a pending request are deliberately distinct outcomes;
 * a restricted Entity never becomes attributed until its controller accepts.
 */
export async function resolveEntityCreditAttributionCreationMode(
	authorization: Authorization<string>,
	tx: DatabaseTransaction,
	entityId: string,
): Promise<EntityCreditAttributionCreationMode> {
	await lockAttributionTarget(tx, entityId);
	if (!(await isEntityTarget(tx, entityId))) throw new EntityEntryNotFound();
	if (await authorization.entity.allowsAssociationCommand(tx, entityId, "credit", "direct"))
		return "direct";
	if (await authorization.entity.allowsAssociationCommand(tx, entityId, "credit", "request"))
		return "request";
	throw new EntityAssociationRestricted("credit", "request");
}
