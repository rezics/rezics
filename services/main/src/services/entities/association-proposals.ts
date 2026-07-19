import { and, desc, eq, isNull, sql } from "drizzle-orm";

import type { Authorization } from "../authorization";
import {
	entityAssociationScope,
	lockEntityAssociationState,
} from "../authorization/entity/authorization";
import type { EntityAssociationKind } from "../authorization/entity/policy";
import { database, type DatabaseTransaction } from "../database";
import {
	auditEvent,
	creditAttribution,
	entity,
	entityAssociationProposal,
	subjectAssociation,
	unit,
} from "../database/schema";
import { fractionalPositionBetween } from "../ordering/position";
import { recordUnitRevision } from "../units/history";
import { UnitNotFound } from "../units/errors";
import {
	EntityAssociationProposalConflict,
	EntityAssociationProposalExpired,
	EntityAssociationProposalNotFound,
	EntityEntryNotFound,
} from "./errors";

export type EntityAssociationProposalState =
	"pending" | "expired" | "accepted" | "declined" | "cancelled";

type ProposalRecord = typeof entityAssociationProposal.$inferSelect;

export const sourceAssociationScope = (kind: EntityAssociationKind) =>
	[kind === "credit" ? "credit-attributions" : "subject-associations"] as const;

export function entityAssociationProposalState(
	record: Pick<ProposalRecord, "resolution" | "expiresAt">,
	now = new Date(),
): EntityAssociationProposalState {
	return record.resolution ?? (record.expiresAt <= now ? "expired" : "pending");
}

export function presentEntityAssociationProposal(record: ProposalRecord, now = new Date()) {
	return { ...record, state: entityAssociationProposalState(record, now) };
}

async function lockAssociationWorkflow(
	tx: DatabaseTransaction,
	sourceUnitId: string,
	targetEntityId: string,
) {
	await lockEntityAssociationState(tx, targetEntityId);
	await tx.execute(
		sql`select pg_advisory_xact_lock(hashtextextended(${`unit-associations:${sourceUnitId}`}::text, 0))`,
	);
}

async function recordProposalAudit(
	tx: DatabaseTransaction,
	input: {
		readonly actorProfileId: string;
		readonly action: string;
		readonly proposalId: string;
		readonly metadata?: Record<string, unknown>;
	},
) {
	await tx.insert(auditEvent).values({
		actorProfileId: input.actorProfileId,
		action: input.action,
		decisionCode: "allowed",
		subjectKind: "entity_association_proposal",
		subjectId: input.proposalId,
		metadata: input.metadata,
	});
}

async function ensureSourceUnitExists(tx: DatabaseTransaction, sourceUnitId: string) {
	const [record] = await tx
		.select({ id: unit.id })
		.from(unit)
		.where(and(eq(unit.id, sourceUnitId), isNull(unit.deletedAt)))
		.limit(1);
	if (!record) throw new UnitNotFound();
}

async function ensureNoRelationshipOrProposal(
	tx: DatabaseTransaction,
	input: {
		readonly sourceUnitId: string;
		readonly targetEntityId: string;
		readonly kind: EntityAssociationKind;
		readonly role: string;
	},
) {
	const associationTable = input.kind === "credit" ? creditAttribution : subjectAssociation;
	const [relationship] = await tx
		.select({ id: associationTable.id })
		.from(associationTable)
		.where(
			and(
				eq(associationTable.unitId, input.sourceUnitId),
				eq(associationTable.entityId, input.targetEntityId),
				eq(associationTable.role, input.role),
			),
		)
		.limit(1);
	if (relationship) throw new EntityAssociationProposalConflict();
	const [proposal] = await tx
		.select({ id: entityAssociationProposal.id })
		.from(entityAssociationProposal)
		.where(
			and(
				eq(entityAssociationProposal.sourceUnitId, input.sourceUnitId),
				eq(entityAssociationProposal.targetEntityId, input.targetEntityId),
				eq(entityAssociationProposal.kind, input.kind),
				eq(entityAssociationProposal.role, input.role),
				isNull(entityAssociationProposal.resolution),
				sql`${entityAssociationProposal.expiresAt} > now()`,
			),
		)
		.limit(1);
	if (proposal) throw new EntityAssociationProposalConflict();
}

async function insertProposal(
	tx: DatabaseTransaction,
	input: {
		readonly sourceUnitId: string;
		readonly targetEntityId: string;
		readonly kind: EntityAssociationKind;
		readonly role: string;
		readonly direction: "request" | "invitation";
		readonly createdByProfileId: string;
		readonly expiresAt: Date;
	},
) {
	const [created] = await tx.insert(entityAssociationProposal).values(input).returning();
	if (!created) throw new Error("Entity association proposal insertion returned no row");
	await recordProposalAudit(tx, {
		actorProfileId: input.createdByProfileId,
		action: `entity.association_proposal.${input.direction}.create`,
		proposalId: created.id,
		metadata: {
			sourceUnitId: input.sourceUnitId,
			targetEntityId: input.targetEntityId,
			kind: input.kind,
			role: input.role,
		},
	});
	return presentEntityAssociationProposal(created);
}

export async function createEntityAssociationRequest(
	authorization: Authorization<string>,
	actorProfileId: string,
	input: {
		readonly sourceUnitId: string;
		readonly targetEntityId: string;
		readonly kind: EntityAssociationKind;
		readonly role: string;
		readonly expiresAt: Date;
	},
) {
	return database.transaction(async (tx) => {
		await lockAssociationWorkflow(tx, input.sourceUnitId, input.targetEntityId);
		await authorization.unit.ensureInTransaction(
			tx,
			input.sourceUnitId,
			"unit.update",
			sourceAssociationScope(input.kind),
		);
		await authorization.entity.ensureAssociationRequestAllowed(
			tx,
			input.targetEntityId,
			input.kind,
		);
		await ensureNoRelationshipOrProposal(tx, input);
		return insertProposal(tx, {
			...input,
			direction: "request",
			createdByProfileId: actorProfileId,
		});
	});
}

export async function createEntityAssociationInvitation(
	authorization: Authorization<string>,
	actorProfileId: string,
	input: {
		readonly sourceUnitId: string;
		readonly targetEntityId: string;
		readonly kind: EntityAssociationKind;
		readonly role: string;
		readonly expiresAt: Date;
	},
) {
	if (input.sourceUnitId === input.targetEntityId) throw new EntityAssociationProposalConflict();
	return database.transaction(async (tx) => {
		await lockAssociationWorkflow(tx, input.sourceUnitId, input.targetEntityId);
		await authorization.entity.ensureAssociationInvitationAllowed(
			tx,
			input.targetEntityId,
			input.kind,
		);
		await ensureSourceUnitExists(tx, input.sourceUnitId);
		await ensureNoRelationshipOrProposal(tx, input);
		return insertProposal(tx, {
			...input,
			direction: "invitation",
			createdByProfileId: actorProfileId,
		});
	});
}

export async function listEntityAssociationProposals(
	authorization: Authorization<string>,
	input: {
		readonly unitId: string;
		readonly side: "source" | "target";
		readonly kind: EntityAssociationKind;
		readonly includeResolved: boolean;
	},
) {
	if (input.side === "source")
		await authorization.unit.ensure(
			input.unitId,
			"unit.update",
			sourceAssociationScope(input.kind),
		);
	else {
		const [target] = await database
			.select({ id: entity.id })
			.from(entity)
			.where(eq(entity.id, input.unitId))
			.limit(1);
		if (!target) throw new EntityEntryNotFound();
		await authorization.unit.ensure(
			input.unitId,
			"unit.association.manage",
			entityAssociationScope(input.kind),
		);
	}
	const sideCondition =
		input.side === "source"
			? eq(entityAssociationProposal.sourceUnitId, input.unitId)
			: eq(entityAssociationProposal.targetEntityId, input.unitId);
	const rows = await database
		.select()
		.from(entityAssociationProposal)
		.where(
			and(
				sideCondition,
				eq(entityAssociationProposal.kind, input.kind),
				input.includeResolved ? undefined : isNull(entityAssociationProposal.resolution),
			),
		)
		.orderBy(desc(entityAssociationProposal.createdAt), desc(entityAssociationProposal.id));
	const now = new Date();
	return rows.map((row) => presentEntityAssociationProposal(row, now));
}

async function loadUnresolvedProposal(
	tx: DatabaseTransaction,
	proposalId: string,
): Promise<ProposalRecord> {
	const [proposal] = await tx
		.select()
		.from(entityAssociationProposal)
		.where(
			and(
				eq(entityAssociationProposal.id, proposalId),
				isNull(entityAssociationProposal.resolution),
			),
		)
		.limit(1);
	if (!proposal) throw new EntityAssociationProposalNotFound();
	if (proposal.expiresAt <= new Date()) throw new EntityAssociationProposalExpired();
	return proposal;
}

async function ensureResolutionAuthorized(
	tx: DatabaseTransaction,
	authorization: Authorization<string>,
	proposal: ProposalRecord,
	actingUnitId: string,
	action: "accept" | "decline" | "cancel",
) {
	const actsForSource =
		action === "cancel"
			? proposal.direction === "request"
			: proposal.direction === "invitation";
	const expectedUnitId = actsForSource ? proposal.sourceUnitId : proposal.targetEntityId;
	if (actingUnitId !== expectedUnitId) throw new EntityAssociationProposalNotFound();
	if (actsForSource)
		await authorization.unit.ensureInTransaction(
			tx,
			proposal.sourceUnitId,
			"unit.update",
			sourceAssociationScope(proposal.kind),
		);
	else
		await authorization.unit.ensureInTransaction(
			tx,
			proposal.targetEntityId,
			"unit.association.manage",
			entityAssociationScope(proposal.kind),
		);
}

async function materializeProposal(
	tx: DatabaseTransaction,
	proposal: ProposalRecord,
	acceptingProfileId: string,
) {
	await ensureNoRelationshipOrProposalForAcceptance(tx, proposal);
	if (proposal.kind === "credit") {
		const [last] = await tx
			.select({ position: creditAttribution.position })
			.from(creditAttribution)
			.where(eq(creditAttribution.unitId, proposal.sourceUnitId))
			.orderBy(desc(creditAttribution.position), desc(creditAttribution.id))
			.limit(1);
		await tx.insert(creditAttribution).values({
			id: proposal.id,
			unitId: proposal.sourceUnitId,
			entityId: proposal.targetEntityId,
			role: proposal.role,
			position: fractionalPositionBetween(last?.position, null),
		});
	} else {
		const [last] = await tx
			.select({ position: subjectAssociation.position })
			.from(subjectAssociation)
			.where(eq(subjectAssociation.unitId, proposal.sourceUnitId))
			.orderBy(desc(subjectAssociation.position), desc(subjectAssociation.id))
			.limit(1);
		await tx.insert(subjectAssociation).values({
			id: proposal.id,
			unitId: proposal.sourceUnitId,
			entityId: proposal.targetEntityId,
			role: proposal.role,
			position: fractionalPositionBetween(last?.position, null),
		});
	}
	await recordUnitRevision(tx, {
		unitId: proposal.sourceUnitId,
		actorProfileId:
			proposal.direction === "request" ? proposal.createdByProfileId : acceptingProfileId,
		event: "update",
	});
}

async function ensureNoRelationshipOrProposalForAcceptance(
	tx: DatabaseTransaction,
	proposal: ProposalRecord,
) {
	const associationTable = proposal.kind === "credit" ? creditAttribution : subjectAssociation;
	const [relationship] = await tx
		.select({ id: associationTable.id })
		.from(associationTable)
		.where(
			and(
				eq(associationTable.unitId, proposal.sourceUnitId),
				eq(associationTable.entityId, proposal.targetEntityId),
				eq(associationTable.role, proposal.role),
			),
		)
		.limit(1);
	if (relationship) throw new EntityAssociationProposalConflict();
}

export async function resolveEntityAssociationProposal(
	authorization: Authorization<string>,
	actorProfileId: string,
	input: {
		readonly actingUnitId: string;
		readonly proposalId: string;
		readonly action: "accept" | "decline" | "cancel";
	},
) {
	return database.transaction(async (tx) => {
		const proposalBeforeLock = await loadUnresolvedProposal(tx, input.proposalId);
		await lockAssociationWorkflow(
			tx,
			proposalBeforeLock.sourceUnitId,
			proposalBeforeLock.targetEntityId,
		);
		const proposal = await loadUnresolvedProposal(tx, input.proposalId);
		await ensureResolutionAuthorized(
			tx,
			authorization,
			proposal,
			input.actingUnitId,
			input.action,
		);
		if (input.action === "accept") await materializeProposal(tx, proposal, actorProfileId);
		const resolution =
			input.action === "accept"
				? "accepted"
				: input.action === "decline"
					? "declined"
					: "cancelled";
		const [resolved] = await tx
			.update(entityAssociationProposal)
			.set({ resolution, resolvedAt: new Date(), resolvedByProfileId: actorProfileId })
			.where(
				and(
					eq(entityAssociationProposal.id, proposal.id),
					isNull(entityAssociationProposal.resolution),
				),
			)
			.returning();
		if (!resolved) throw new EntityAssociationProposalConflict();
		await recordProposalAudit(tx, {
			actorProfileId,
			action: `entity.association_proposal.${input.action}`,
			proposalId: proposal.id,
			metadata: { actingUnitId: input.actingUnitId },
		});
		return presentEntityAssociationProposal(resolved);
	});
}
