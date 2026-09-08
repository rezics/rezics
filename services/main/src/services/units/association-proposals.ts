import { and, desc, eq, isNull, lt, or, sql } from "drizzle-orm";

import { z } from "zod";
import {
	ParticipationAuthoritySchema,
	ParticipationDenied,
	type ParticipationAuthority,
} from "../participation/policy";
import { InvalidPaginationCursor } from "../pagination/errors";
import { readUnitStateById } from "./query";
import { creditRoleAllowedForReference } from "./credit-role-contract";
import { recordAuditEvent } from "../audit";
import { Authorization } from "../authorization";
import { database, type DatabaseTransaction } from "../database";
import { creditAttribution, subjectAssociation, unitAssociationProposal } from "../database/schema";
import {
	type AssociationKind,
	type CreditAttributionRole,
	isCreditAttributionRole,
	isSubjectAssociationRole,
	type SubjectAssociationRole,
} from "../database/schema/contract-values";
import { EntityEntryNotFound } from "../entities/errors";
import { fractionalPositionBetween } from "../ordering/position";
import { ensureWikiAssociationContextPost } from "./association-context";
import {
	ensureCreditAttributionInvitationAllowed,
	ensureCreditAttributionRequestAllowed,
} from "./attribution-authorization";
import {
	AssociationContextPostInvalid,
	AssociationProposalConflict,
	AssociationProposalExpired,
	AssociationProposalNotFound,
	AssociationProposalRoleInvalid,
	UnitNotFound,
} from "./errors";
import { recordResourceRevision, ensureResourceUpdateAllowed } from "./resource-history";
import type { RevisionContributionInput } from "./revision-contribution";

export type AssociationProposalState =
	| "pending"
	| "expired"
	| "accepted"
	| "declined"
	| "cancelled";

type ProposalRecord = typeof unitAssociationProposal.$inferSelect;
type AssociationRoleInput =
	| {
			readonly kind: "credit";
			readonly role: CreditAttributionRole;
			readonly contextPostId?: never;
	  }
	| {
			readonly kind: "subject";
			readonly role: SubjectAssociationRole;
			readonly contextPostId?: string;
	  };
type AssociationTargetInput = {
	readonly sourceUnitId: string;
	readonly targetUnitId: string;
} & AssociationRoleInput;
type CreateAssociationProposalInput = AssociationTargetInput & {
	readonly expiresAt: Date;
};

export const sourceAssociationScope = (kind: AssociationKind) =>
	[kind === "credit" ? "credit-attributions" : "subject-associations"] as const;

async function ensureAssociationTargetController(tx:DatabaseTransaction,authorization:Authorization<string>,targetId:string,kind:AssociationKind) {
	if(kind==="credit") return ensureCreditAttributionInvitationAllowed(authorization,tx,targetId);
	return authorization.entity.ensureAssociationInvitationAllowed(tx,targetId,kind);
}

export function associationProposalState(
	record: Pick<ProposalRecord, "resolution" | "expiresAt">,
	now = new Date(),
): AssociationProposalState {
	return record.resolution ?? (record.expiresAt <= now ? "expired" : "pending");
}

/** Public operational response intentionally excludes private principal/grant and concrete routing columns. */
export function presentAssociationProposal(
	record: Pick<
		ProposalRecord,
		| "id"
		| "sourceUnitId"
		| "targetUnitId"
		| "direction"
		| "createdByProfileId"
		| "expiresAt"
		| "resolution"
		| "resolvedAt"
		| "resolvedByProfileId"
		| "createdAt"
		| "updatedAt"
		| "kind"
		| "role"
		| "contextPostId"
	>,
	now = new Date(),
) {
	const visible = {
		id: record.id,
		sourceUnitId: record.sourceUnitId,
		targetUnitId: record.targetUnitId,
		direction: record.direction,
		createdByProfileId: record.createdByProfileId,
		expiresAt: record.expiresAt,
		resolution: record.resolution,
		resolvedAt: record.resolvedAt,
		resolvedByProfileId: record.resolvedByProfileId,
		createdAt: record.createdAt,
		updatedAt: record.updatedAt,
		state: associationProposalState(record, now),
	};
	if (record.kind === "credit" && isCreditAttributionRole(record.role))
		return { ...visible, kind: record.kind, role: record.role, contextPostId: null };
	if (record.kind === "subject" && isSubjectAssociationRole(record.role))
		return {
			...visible,
			kind: record.kind,
			role: record.role,
			contextPostId: record.contextPostId ?? null,
		};
	throw new TypeError("Stored association proposal role does not match its kind");
}
function creatorAuthority(
	authorization: Authorization<string>,
	actorProfileId: string,
): ParticipationAuthority {
	if (
		actorProfileId !== authorization.profileId ||
		!authorization.authUserId ||
		!authorization.participationAuthority
	)
		throw new ParticipationDenied();
	const authority = ParticipationAuthoritySchema.parse(authorization.participationAuthority);
	if (authority.principal.authUserId !== authorization.authUserId) throw new ParticipationDenied();
	return authority;
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
		readonly actorAuthUserId: string;
		readonly action: string;
		readonly authorityUnitId: string;
		readonly proposalId: string;
		readonly metadata?: Record<string, unknown>;
	},
) {
	await recordAuditEvent(tx, {
		category: "admin_activity",
		outcome: "succeeded",
		actor: { kind: "auth", authUserId: input.actorAuthUserId },
		authority: { kind: "unit", id: input.authorityUnitId },
		action: input.action,
		target: { kind: "unit_association_proposal", id: input.proposalId },
		details: input.metadata,
	});
}

async function ensureSourceUnitExists(tx: DatabaseTransaction, sourceUnitId: string) {
	if (!(await readUnitStateById(tx, sourceUnitId))) throw new UnitNotFound();
}
async function ensureCreditSourceRoleAllowed(
	tx: DatabaseTransaction,
	sourceUnitId: string,
	role: CreditAttributionRole,
) {
	const current = await readUnitStateById(tx, sourceUnitId);
	if (!current) throw new UnitNotFound();
	if (!(await creditRoleAllowedForReference(tx, current.reference, role)))
		throw new AssociationProposalRoleInvalid();
}

async function ensureNoRelationshipOrProposal(
	tx: DatabaseTransaction,
	input: AssociationTargetInput,
) {
	const [relationship] =
		input.kind === "credit"
			? await tx
					.select({ id: creditAttribution.id })
					.from(creditAttribution)
					.where(
						and(
							eq(creditAttribution.sourceUnitId, input.sourceUnitId),
							eq(creditAttribution.creditedEntityId, input.targetUnitId),
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
	input: AssociationTargetInput & {
		readonly direction: "request" | "invitation";
		readonly createdByProfileId: string;
		readonly creatorAuthority: ParticipationAuthority;
		readonly expiresAt: Date;
	},
) {
	const [created] = await tx
		.insert(unitAssociationProposal)
		.values({
			...input,
			contextPostId: input.kind === "subject" ? (input.contextPostId ?? null) : null,
		})
		.returning();
	if (!created) throw new Error("Association proposal insertion returned no row");
	await recordProposalAudit(tx, {
		actorAuthUserId: input.creatorAuthority.principal.authUserId,
		action: `unit.association_proposal.${input.direction}.create`,
		authorityUnitId: input.sourceUnitId,
		proposalId: created.id,
		metadata: {
			sourceUnitId: input.sourceUnitId,
			targetUnitId: input.targetUnitId,
			kind: input.kind,
			role: input.role,
			contextPostId: input.kind === "subject" ? (input.contextPostId ?? null) : null,
		},
	});
	return presentAssociationProposal(created);
}

export async function createAssociationRequest(
	authorization: Authorization<string>,
	actorProfileId: string,
	input: CreateAssociationProposalInput,
) {
	return database.transaction((tx) =>
		createAssociationRequestInTransaction(tx, authorization, actorProfileId, input),
	);
}

export async function createAssociationRequestInTransaction(
	tx: DatabaseTransaction,
	authorization: Authorization<string>,
	actorProfileId: string,
	input: CreateAssociationProposalInput,
) {
	if (input.sourceUnitId === input.targetUnitId) throw new AssociationProposalConflict();
	await lockAssociationWorkflow(tx, input.sourceUnitId, input.targetUnitId);
	await ensureResourceUpdateAllowed(tx,authorization.unit,input.sourceUnitId,sourceAssociationScope(input.kind));
	if (input.kind === "credit") {
		await ensureCreditSourceRoleAllowed(tx, input.sourceUnitId, input.role);
		await ensureCreditAttributionRequestAllowed(authorization, tx, input.targetUnitId);
	} else {
		if (input.contextPostId) {
			await authorization.unit.ensureCanRead(
				input.contextPostId,
				() => new AssociationContextPostInvalid(),
			);
			await ensureWikiAssociationContextPost(tx, input.contextPostId);
		}
		await authorization.entity.ensureAssociationRequestAllowed(tx, input.targetUnitId, input.kind);
	}
	await ensureNoRelationshipOrProposal(tx, input);
	return insertProposal(tx, {
		...input,
		direction: "request",
		createdByProfileId: authorization.profileId,
		creatorAuthority: creatorAuthority(authorization, actorProfileId),
	});
}

export async function createAssociationInvitation(
	authorization: Authorization<string>,
	actorProfileId: string,
	input: CreateAssociationProposalInput,
) {
	if (input.sourceUnitId === input.targetUnitId) throw new AssociationProposalConflict();
	return database.transaction(async (tx) => {
		await lockAssociationWorkflow(tx, input.sourceUnitId, input.targetUnitId);
		if (input.kind === "credit")
			await ensureCreditAttributionInvitationAllowed(authorization, tx, input.targetUnitId);
		else {
			if (input.contextPostId) {
				await authorization.unit.ensureCanRead(
					input.contextPostId,
					() => new AssociationContextPostInvalid(),
				);
				await ensureWikiAssociationContextPost(tx, input.contextPostId);
			}
			await authorization.entity.ensureAssociationInvitationAllowed(
				tx,
				input.targetUnitId,
				input.kind,
			);
		}
		if (input.kind === "credit")
			await ensureCreditSourceRoleAllowed(tx, input.sourceUnitId, input.role);
		else await ensureSourceUnitExists(tx, input.sourceUnitId);
		await ensureNoRelationshipOrProposal(tx, input);
		return insertProposal(tx, {
			...input,
			direction: "invitation",
			createdByProfileId: authorization.profileId,
			creatorAuthority: creatorAuthority(authorization, actorProfileId),
		});
	});
}

const ProposalCursor = z.strictObject({
	v: z.literal(1),
	unitId: z.uuid(),
	side: z.enum(["source", "target"]),
	kind: z.enum(["credit", "subject"]),
	includeResolved: z.boolean(),
	createdAt: z.iso.datetime(),
	id: z.uuid(),
});
export async function listAssociationProposals(
	authorization: Authorization<string>,
	input: {
		readonly unitId: string;
		readonly side: "source" | "target";
		readonly kind: AssociationKind;
		readonly includeResolved: boolean;
		readonly limit?: number;
		readonly cursor?: string;
	},
) {
	const limit = z
		.number()
		.int()
		.min(1)
		.max(100)
		.parse(input.limit ?? 50);
	let cursor: z.output<typeof ProposalCursor> | undefined;
	if (input.cursor) {
		try {
			cursor = ProposalCursor.parse(
				JSON.parse(Buffer.from(input.cursor, "base64url").toString("utf8")),
			);
			if (
				cursor.unitId !== input.unitId ||
				cursor.side !== input.side ||
				cursor.kind !== input.kind ||
				cursor.includeResolved !== input.includeResolved
			)
				throw new InvalidPaginationCursor();
		} catch {
			throw new InvalidPaginationCursor();
		}
	}
	return database.transaction(
		async (tx) => {
			if (input.side === "source")
				await ensureResourceUpdateAllowed(tx,authorization.unit,input.unitId,sourceAssociationScope(input.kind));
			else {
				if (input.kind === "subject") {
					const target = await readUnitStateById(tx, input.unitId);
					if (target?.reference.owner !== "entity") throw new EntityEntryNotFound();
				}
				await ensureAssociationTargetController(tx,authorization,input.unitId,input.kind);
			}
			const source =
				input.side === "source"
					? unitAssociationProposal.sourceUnitId
					: unitAssociationProposal.targetUnitId;
			const rows = await tx
				.select()
				.from(unitAssociationProposal)
				.where(
					and(
						eq(source, input.unitId),
						input.includeResolved ? undefined : isNull(unitAssociationProposal.resolution),
						cursor
							? or(
									lt(unitAssociationProposal.createdAt, new Date(cursor.createdAt)),
									and(
										eq(unitAssociationProposal.createdAt, new Date(cursor.createdAt)),
										lt(unitAssociationProposal.id, cursor.id),
									),
								)
							: undefined,
					),
				)
				.orderBy(desc(unitAssociationProposal.createdAt), desc(unitAssociationProposal.id))
				.limit(256);
			const matching = rows.filter((row) => row.kind === input.kind),
				page = matching.slice(0, limit),
				last =
					matching.length > limit ? page.at(-1) : rows.length === 256 ? rows.at(-1) : undefined;
			return {
				items: page.map((row) => presentAssociationProposal(row)),
				nextCursor: last
					? Buffer.from(
							JSON.stringify({
								v: 1,
								unitId: input.unitId,
								side: input.side,
								kind: input.kind,
								includeResolved: input.includeResolved,
								createdAt: last.createdAt.toISOString(),
								id: last.id,
							}),
						).toString("base64url")
					: null,
			};
		},
		{ isolationLevel: "repeatable read" },
	);
}

async function loadUnresolvedProposal(
	tx: DatabaseTransaction,
	proposalId: string,
): Promise<ProposalRecord> {
	const [proposal] = await tx
		.select()
		.from(unitAssociationProposal)
		.where(
			and(eq(unitAssociationProposal.id, proposalId), isNull(unitAssociationProposal.resolution)),
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
		action === "cancel" ? proposal.direction === "request" : proposal.direction === "invitation";
	const expectedUnitId = actsForSource ? proposal.sourceUnitId : proposal.targetUnitId;
	if (actingUnitId !== expectedUnitId) throw new AssociationProposalNotFound();
	if (actsForSource)
		await ensureResourceUpdateAllowed(tx,authorization.unit,proposal.sourceUnitId,sourceAssociationScope(proposal.kind));
	else
		await ensureAssociationTargetController(tx,authorization,proposal.targetUnitId,proposal.kind);
}

async function materializeProposal(
	tx: DatabaseTransaction,
	proposal: ProposalRecord,
	acceptingAuthorization: Authorization<string>,
	contribution: RevisionContributionInput | undefined,
) {
	const admitted = ParticipationAuthoritySchema.parse(proposal.creatorAuthority);
	const proposerAuthorization = new Authorization(
		proposal.createdByProfileId,
		admitted.principal.authUserId,
		admitted,
	);
	if (proposal.direction === "request")
		await ensureResourceUpdateAllowed(tx,proposerAuthorization.unit,proposal.sourceUnitId,sourceAssociationScope(proposal.kind));
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
		if (!isCreditAttributionRole(proposal.role))
			throw new TypeError("Stored credit proposal has an invalid role");
		await ensureCreditSourceRoleAllowed(tx, proposal.sourceUnitId, proposal.role);
		const [last] = await tx
			.select({ position: creditAttribution.position })
			.from(creditAttribution)
			.where(eq(creditAttribution.sourceUnitId, proposal.sourceUnitId))
			.orderBy(desc(creditAttribution.position), desc(creditAttribution.id))
			.limit(1);
		await tx.insert(creditAttribution).values({
			id: proposal.id,
			sourceUnitId: proposal.sourceUnitId,
			creditedEntityId: proposal.targetUnitId,
			role: proposal.role,
			position: fractionalPositionBetween(last?.position, null),
		});
	} else {
		if (!isSubjectAssociationRole(proposal.role))
			throw new TypeError("Stored subject proposal has an invalid role");
		if (proposal.contextPostId) {
			await proposerAuthorization.unit.ensureCanRead(
				proposal.contextPostId,
				() => new AssociationContextPostInvalid(),
			);
			await ensureWikiAssociationContextPost(tx, proposal.contextPostId);
		}
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
			contextPostId: proposal.contextPostId,
			role: proposal.role,
			position: fractionalPositionBetween(last?.position, null),
		});
	}
	await recordResourceRevision(
		tx,
		proposal.direction === "request" ? proposerAuthorization : acceptingAuthorization,
		{
			unitId: proposal.sourceUnitId,
			actorProfileId:
				proposal.direction === "request"
					? proposal.createdByProfileId
					: acceptingAuthorization.profileId,
			contribution,
			event: "update",
		},
	);
}

async function ensureNoRelationshipOrProposalForAcceptance(
	tx: DatabaseTransaction,
	proposal: ProposalRecord,
) {
	const [relationship] =
		proposal.kind === "credit"
			? isCreditAttributionRole(proposal.role)
				? await tx
						.select({ id: creditAttribution.id })
						.from(creditAttribution)
						.where(
							and(
								eq(creditAttribution.sourceUnitId, proposal.sourceUnitId),
								eq(creditAttribution.creditedEntityId, proposal.targetUnitId),
								eq(creditAttribution.role, proposal.role),
							),
						)
						.limit(1)
				: (() => {
						throw new TypeError("Stored credit proposal has an invalid role");
					})()
			: isSubjectAssociationRole(proposal.role)
				? await tx
						.select({ id: subjectAssociation.id })
						.from(subjectAssociation)
						.where(
							and(
								eq(subjectAssociation.unitId, proposal.sourceUnitId),
								eq(subjectAssociation.entityId, proposal.targetUnitId),
								eq(subjectAssociation.role, proposal.role),
							),
						)
						.limit(1)
				: (() => {
						throw new TypeError("Stored subject proposal has an invalid role");
					})();
	if (relationship) throw new AssociationProposalConflict();
}

export async function resolveAssociationProposal(
	authorization: Authorization<string>,
	actorProfileId: string,
	input: {
		readonly actingUnitId: string;
		readonly proposalId: string;
		readonly action: "accept" | "decline" | "cancel";
		readonly contribution?: RevisionContributionInput;
	},
) {
	const admitted = creatorAuthority(authorization, actorProfileId);
	return database.transaction(async (tx) => {
		const proposalBeforeLock = await loadUnresolvedProposal(tx, input.proposalId);
		await lockAssociationWorkflow(
			tx,
			proposalBeforeLock.sourceUnitId,
			proposalBeforeLock.targetUnitId,
		);
		const proposal = await loadUnresolvedProposal(tx, input.proposalId);
		await ensureResolutionAuthorized(tx, authorization, proposal, input.actingUnitId, input.action);
		if (input.action === "accept" && proposal.kind === "subject" && proposal.contextPostId)
			await authorization.unit.ensureCanRead(
				proposal.contextPostId,
				() => new AssociationContextPostInvalid(),
			);
		if (input.action === "accept")
			await materializeProposal(tx, proposal, authorization, input.contribution);
		const resolution =
			input.action === "accept"
				? "accepted"
				: input.action === "decline"
					? "declined"
					: "cancelled";
		const [resolved] = await tx
			.update(unitAssociationProposal)
			.set({
				resolution,
				resolvedAt: new Date(),
				resolvedByProfileId: authorization.profileId,
				resolvedByAuthUserId: admitted.principal.authUserId,
			})
			.where(
				and(
					eq(unitAssociationProposal.id, proposal.id),
					isNull(unitAssociationProposal.resolution),
				),
			)
			.returning();
		if (!resolved) throw new AssociationProposalConflict();
		await recordProposalAudit(tx, {
			actorAuthUserId: admitted.principal.authUserId,
			action: `unit.association_proposal.${input.action}`,
			authorityUnitId: input.actingUnitId,
			proposalId: proposal.id,
			metadata: { actingUnitId: input.actingUnitId },
		});
		return presentAssociationProposal(resolved);
	});
}
