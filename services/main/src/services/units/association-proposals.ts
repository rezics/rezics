import { and, desc, eq, isNull, sql } from "drizzle-orm";

import { Authorization } from "../authorization";
import { associationTargetScope } from "../authorization/unit/scope";
import { database, type DatabaseTransaction } from "../database";
import type { AssociationKind } from "../database/schema/contract-values";
import {
	auditEvent,
	creditAttribution,
	entity,
	unitAssociationProposal,
	subjectAssociation,
	unit,
} from "../database/schema";
import { fractionalPositionBetween } from "../ordering/position";
import { EntityEntryNotFound } from "../entities/errors";
import { recordUnitRevision } from "./history";
import {
	ensureCreditAttributionInvitationAllowed,
	ensureCreditAttributionRequestAllowed,
} from "./attribution-authorization";
import {
	AssociationProposalConflict,
	AssociationProposalExpired,
	AssociationProposalNotFound,
	UnitNotFound,
} from "./errors";

export type AssociationProposalState =
	"pending" | "expired" | "accepted" | "declined" | "cancelled";

type ProposalRecord = typeof unitAssociationProposal.$inferSelect;

export const sourceAssociationScope = (kind: AssociationKind) =>
	[kind === "credit" ? "credit-attributions" : "subject-associations"] as const;

export function associationProposalState(
	record: Pick<ProposalRecord, "resolution" | "expiresAt">,
	now = new Date(),
): AssociationProposalState {
	return record.resolution ?? (record.expiresAt <= now ? "expired" : "pending");
}

export function presentAssociationProposal(record: ProposalRecord, now = new Date()) {
	return { ...record, state: associationProposalState(record, now) };
}

async function lockAssociationWorkflow(
	tx: DatabaseTransaction,
	sourceUnitId: string,
	targetUnitId: string,
) {
	await tx.execute(
		sql`select pg_advisory_xact_lock(hashtextextended(${`unit-associations:${sourceUnitId}:${targetUnitId}`}::text, 0))`,
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
		subjectKind: "unit_association_proposal",
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
		readonly targetUnitId: string;
		readonly kind: AssociationKind;
		readonly role: string;
	},
) {
	const [relationship] =
		input.kind === "credit"
			? await tx
					.select({ id: creditAttribution.id })
					.from(creditAttribution)
					.where(
						and(
							eq(creditAttribution.sourceUnitId, input.sourceUnitId),
							eq(creditAttribution.creditedUnitId, input.targetUnitId),
							eq(creditAttribution.role, input.role),
						),
					)
					.limit(1)
			: await tx
					.select({ id: subjectAssociation.id })
					.from(subjectAssociation)
					.where(
						and(
							eq(subjectAssociation.unitId, input.sourceUnitId),
							eq(subjectAssociation.entityId, input.targetUnitId),
							eq(subjectAssociation.role, input.role),
						),
					)
					.limit(1);
	if (relationship) throw new AssociationProposalConflict();
	const [proposal] = await tx
		.select({ id: unitAssociationProposal.id })
		.from(unitAssociationProposal)
		.where(
			and(
				eq(unitAssociationProposal.sourceUnitId, input.sourceUnitId),
				eq(unitAssociationProposal.targetUnitId, input.targetUnitId),
				eq(unitAssociationProposal.kind, input.kind),
				eq(unitAssociationProposal.role, input.role),
				isNull(unitAssociationProposal.resolution),
				sql`${unitAssociationProposal.expiresAt} > now()`,
			),
		)
		.limit(1);
	if (proposal) throw new AssociationProposalConflict();
}

async function insertProposal(
	tx: DatabaseTransaction,
	input: {
		readonly sourceUnitId: string;
		readonly targetUnitId: string;
		readonly kind: AssociationKind;
		readonly role: string;
		readonly direction: "request" | "invitation";
		readonly createdByProfileId: string;
		readonly expiresAt: Date;
	},
) {
	const [created] = await tx.insert(unitAssociationProposal).values(input).returning();
	if (!created) throw new Error("Association proposal insertion returned no row");
	await recordProposalAudit(tx, {
		actorProfileId: input.createdByProfileId,
		action: `unit.association_proposal.${input.direction}.create`,
		proposalId: created.id,
		metadata: {
			sourceUnitId: input.sourceUnitId,
			targetUnitId: input.targetUnitId,
			kind: input.kind,
			role: input.role,
		},
	});
	return presentAssociationProposal(created);
}

export async function createAssociationRequest(
	authorization: Authorization<string>,
	actorProfileId: string,
	input: {
		readonly sourceUnitId: string;
		readonly targetUnitId: string;
		readonly kind: AssociationKind;
		readonly role: string;
		readonly expiresAt: Date;
	},
) {
	return database.transaction(async (tx) => {
		await lockAssociationWorkflow(tx, input.sourceUnitId, input.targetUnitId);
		await authorization.unit.ensureInTransaction(
			tx,
			input.sourceUnitId,
			"unit.update",
			sourceAssociationScope(input.kind),
		);
		if (input.kind === "credit")
			await ensureCreditAttributionRequestAllowed(authorization, tx, input.targetUnitId);
		else
			await authorization.entity.ensureAssociationRequestAllowed(
				tx,
				input.targetUnitId,
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

export async function createAssociationInvitation(
	authorization: Authorization<string>,
	actorProfileId: string,
	input: {
		readonly sourceUnitId: string;
		readonly targetUnitId: string;
		readonly kind: AssociationKind;
		readonly role: string;
		readonly expiresAt: Date;
	},
) {
	if (input.sourceUnitId === input.targetUnitId) throw new AssociationProposalConflict();
	return database.transaction(async (tx) => {
		await lockAssociationWorkflow(tx, input.sourceUnitId, input.targetUnitId);
		if (input.kind === "credit")
			await ensureCreditAttributionInvitationAllowed(authorization, tx, input.targetUnitId);
		else
			await authorization.entity.ensureAssociationInvitationAllowed(
				tx,
				input.targetUnitId,
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

export async function listAssociationProposals(
	authorization: Authorization<string>,
	input: {
		readonly unitId: string;
		readonly side: "source" | "target";
		readonly kind: AssociationKind;
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
		if (input.kind === "subject") {
			const [target] = await database
				.select({ id: entity.id })
				.from(entity)
				.where(eq(entity.id, input.unitId))
				.limit(1);
			if (!target) throw new EntityEntryNotFound();
		}
		await authorization.unit.ensure(
			input.unitId,
			"unit.association.manage",
			associationTargetScope(input.kind),
		);
	}
	const sideCondition =
		input.side === "source"
			? eq(unitAssociationProposal.sourceUnitId, input.unitId)
			: eq(unitAssociationProposal.targetUnitId, input.unitId);
	const rows = await database
		.select()
		.from(unitAssociationProposal)
		.where(
			and(
				sideCondition,
				eq(unitAssociationProposal.kind, input.kind),
				input.includeResolved ? undefined : isNull(unitAssociationProposal.resolution),
			),
		)
		.orderBy(desc(unitAssociationProposal.createdAt), desc(unitAssociationProposal.id));
	const now = new Date();
	return rows.map((row) => presentAssociationProposal(row, now));
}

async function loadUnresolvedProposal(
	tx: DatabaseTransaction,
	proposalId: string,
): Promise<ProposalRecord> {
	const [proposal] = await tx
		.select()
		.from(unitAssociationProposal)
		.where(
			and(
				eq(unitAssociationProposal.id, proposalId),
				isNull(unitAssociationProposal.resolution),
			),
		)
		.limit(1);
	if (!proposal) throw new AssociationProposalNotFound();
	if (proposal.expiresAt <= new Date()) throw new AssociationProposalExpired();
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
	const expectedUnitId = actsForSource ? proposal.sourceUnitId : proposal.targetUnitId;
	if (actingUnitId !== expectedUnitId) throw new AssociationProposalNotFound();
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
			proposal.targetUnitId,
			"unit.association.manage",
			associationTargetScope(proposal.kind),
		);
}

async function materializeProposal(
	tx: DatabaseTransaction,
	proposal: ProposalRecord,
	acceptingProfileId: string,
) {
	const proposerAuthorization = new Authorization(proposal.createdByProfileId);
	if (proposal.direction === "request")
		await proposerAuthorization.unit.ensureInTransaction(
			tx,
			proposal.sourceUnitId,
			"unit.update",
			sourceAssociationScope(proposal.kind),
		);
	else if (proposal.kind === "credit")
		await ensureCreditAttributionInvitationAllowed(
			proposerAuthorization,
			tx,
			proposal.targetUnitId,
		);
	else
		await proposerAuthorization.entity.ensureAssociationInvitationAllowed(
			tx,
			proposal.targetUnitId,
			proposal.kind,
		);
	await ensureNoRelationshipOrProposalForAcceptance(tx, proposal);
	if (proposal.kind === "credit") {
		const [last] = await tx
			.select({ position: creditAttribution.position })
			.from(creditAttribution)
			.where(eq(creditAttribution.sourceUnitId, proposal.sourceUnitId))
			.orderBy(desc(creditAttribution.position), desc(creditAttribution.id))
			.limit(1);
		await tx.insert(creditAttribution).values({
			id: proposal.id,
			sourceUnitId: proposal.sourceUnitId,
			creditedUnitId: proposal.targetUnitId,
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
			entityId: proposal.targetUnitId,
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
	const [relationship] =
		proposal.kind === "credit"
			? await tx
					.select({ id: creditAttribution.id })
					.from(creditAttribution)
					.where(
						and(
							eq(creditAttribution.sourceUnitId, proposal.sourceUnitId),
							eq(creditAttribution.creditedUnitId, proposal.targetUnitId),
							eq(creditAttribution.role, proposal.role),
						),
					)
					.limit(1)
			: await tx
					.select({ id: subjectAssociation.id })
					.from(subjectAssociation)
					.where(
						and(
							eq(subjectAssociation.unitId, proposal.sourceUnitId),
							eq(subjectAssociation.entityId, proposal.targetUnitId),
							eq(subjectAssociation.role, proposal.role),
						),
					)
					.limit(1);
	if (relationship) throw new AssociationProposalConflict();
}

export async function resolveAssociationProposal(
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
			proposalBeforeLock.targetUnitId,
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
			.update(unitAssociationProposal)
			.set({ resolution, resolvedAt: new Date(), resolvedByProfileId: actorProfileId })
			.where(
				and(
					eq(unitAssociationProposal.id, proposal.id),
					isNull(unitAssociationProposal.resolution),
				),
			)
			.returning();
		if (!resolved) throw new AssociationProposalConflict();
		await recordProposalAudit(tx, {
			actorProfileId,
			action: `unit.association_proposal.${input.action}`,
			proposalId: proposal.id,
			metadata: { actingUnitId: input.actingUnitId },
		});
		return presentAssociationProposal(resolved);
	});
}
