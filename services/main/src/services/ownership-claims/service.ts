import { and, desc, eq, isNull, lt, or, sql } from "drizzle-orm";

import { recordAuditEvent } from "../audit";
import { OfficialProfileIds } from "../bootstrap/data";
import type { PlatformAuthorization } from "../authorization/platform/authorization";
import {
	replaceUnitOwnership,
	unitOwnershipModeFromOwnerProfileId,
} from "../authorization/unit/ownership";
import { lockUnitAccessState } from "../authorization/unit/invitations";
import { database, type DatabaseTransaction } from "../database";
import {
	profile,
	unit,
	unitOwnership,
	unitOwnershipClaim,
	type UnitOwnershipClaimResolution,
	UnitOwnershipClaimableUnitKindValues,
} from "../database/schema";
import { createNotification } from "../notifications/service";
import { recordUnitRevision } from "../units/history";
import { firstUnitLocalizationTitle } from "../units/localization";
import { UnitNotFound } from "../units/errors";
import {
	createGovernanceDecision,
	type GovernanceRuleReference,
} from "../governance/decision-service";
import {
	UnitOwnershipClaimAlreadyPending,
	UnitOwnershipClaimChanged,
	UnitOwnershipClaimNotFound,
	UnitOwnershipClaimSelfDecisionForbidden,
	UnitOwnershipClaimUnavailable,
} from "./errors";

type ClaimRecord = typeof unitOwnershipClaim.$inferSelect;
export type UnitOwnershipClaimState = "pending" | UnitOwnershipClaimResolution;
export type UnitOwnershipClaimDecision = "approved" | "rejected";

const ClaimableUnitKinds: ReadonlySet<string> = new Set(UnitOwnershipClaimableUnitKindValues);

export function unitOwnershipClaimState(
	record: Pick<ClaimRecord, "resolution">,
): UnitOwnershipClaimState {
	return record.resolution ?? "pending";
}

export function isUnitOwnershipClaimEligible(input: {
	readonly kind: string;
	readonly deletedAt: Date | null;
	readonly ownerProfileId: string | null;
}): boolean {
	return (
		ClaimableUnitKinds.has(input.kind) &&
		input.deletedAt === null &&
		input.ownerProfileId === OfficialProfileIds.community
	);
}

function activeOwnerProfileId(unitId: typeof unit.id) {
	return sql<string | null>`(
		select ${unitOwnership.profileId}
		from ${unitOwnership}
		where ${unitOwnership.unitId} = ${unitId}
			and ${unitOwnership.revokedAt} is null
		limit 1
	)`;
}

export async function getPendingUnitOwnershipClaim(
	unitId: string,
	claimantProfileId: string | null | undefined,
) {
	if (!claimantProfileId) return null;
	const [claim] = await database
		.select({
			id: unitOwnershipClaim.id,
			details: unitOwnershipClaim.details,
			createdAt: unitOwnershipClaim.createdAt,
		})
		.from(unitOwnershipClaim)
		.where(
			and(
				eq(unitOwnershipClaim.unitId, unitId),
				eq(unitOwnershipClaim.claimantProfileId, claimantProfileId),
				isNull(unitOwnershipClaim.resolution),
			),
		)
		.limit(1);
	return claim ?? null;
}

async function loadClaimableUnit(tx: DatabaseTransaction, unitId: string) {
	const [record] = await tx
		.select({
			id: unit.id,
			kind: unit.kind,
			deletedAt: unit.deletedAt,
			ownerProfileId: activeOwnerProfileId(unit.id),
		})
		.from(unit)
		.where(eq(unit.id, unitId))
		.limit(1)
		.for("update");
	if (!record) throw new UnitNotFound();
	return record;
}

export async function createUnitOwnershipClaim(input: {
	readonly unitId: string;
	readonly claimantProfileId: string;
	readonly details: string;
}) {
	return database.transaction(async (tx) => {
		await lockUnitAccessState(tx, [input.unitId]);
		const target = await loadClaimableUnit(tx, input.unitId);
		if (
			input.claimantProfileId === OfficialProfileIds.community ||
			!isUnitOwnershipClaimEligible(target)
		)
			throw new UnitOwnershipClaimUnavailable();

		const [sourceOwnership] = await tx
			.select({ id: unitOwnership.id })
			.from(unitOwnership)
			.where(
				and(
					eq(unitOwnership.unitId, input.unitId),
					eq(unitOwnership.profileId, OfficialProfileIds.community),
					isNull(unitOwnership.revokedAt),
				),
			)
			.limit(1)
			.for("update");
		if (!sourceOwnership) throw new UnitOwnershipClaimUnavailable();

		const [pending] = await tx
			.select({ id: unitOwnershipClaim.id })
			.from(unitOwnershipClaim)
			.where(
				and(
					eq(unitOwnershipClaim.unitId, input.unitId),
					eq(unitOwnershipClaim.claimantProfileId, input.claimantProfileId),
					isNull(unitOwnershipClaim.resolution),
				),
			)
			.limit(1)
			.for("update");
		if (pending) throw new UnitOwnershipClaimAlreadyPending();

		const [claim] = await tx
			.insert(unitOwnershipClaim)
			.values({
				unitId: input.unitId,
				claimantProfileId: input.claimantProfileId,
				sourceOwnershipId: sourceOwnership.id,
				details: input.details,
			})
			.returning({
				id: unitOwnershipClaim.id,
				details: unitOwnershipClaim.details,
				createdAt: unitOwnershipClaim.createdAt,
			});
		if (!claim) throw new Error("Unit ownership claim insertion returned no row");
		return claim;
	});
}

export async function withdrawUnitOwnershipClaim(input: {
	readonly claimId: string;
	readonly claimantProfileId: string;
}) {
	return database.transaction(async (tx) => {
		const [claim] = await tx
			.select()
			.from(unitOwnershipClaim)
			.where(
				and(
					eq(unitOwnershipClaim.id, input.claimId),
					eq(unitOwnershipClaim.claimantProfileId, input.claimantProfileId),
				),
			)
			.limit(1)
			.for("update");
		if (!claim) throw new UnitOwnershipClaimNotFound();
		if (claim.resolution !== null) throw new UnitOwnershipClaimChanged();
		const now = new Date();
		const [resolved] = await tx
			.update(unitOwnershipClaim)
			.set({
				resolution: "withdrawn",
				resolvedAt: now,
				resolvedByProfileId: input.claimantProfileId,
				updatedAt: now,
			})
			.where(and(eq(unitOwnershipClaim.id, claim.id), isNull(unitOwnershipClaim.resolution)))
			.returning({ id: unitOwnershipClaim.id });
		if (!resolved) throw new UnitOwnershipClaimChanged();
		return { id: resolved.id };
	});
}

export interface UnitOwnershipClaimCursorBoundary {
	readonly createdAt: Date;
	readonly id: string;
}

export async function listPlatformUnitOwnershipClaims(input: {
	readonly state?: UnitOwnershipClaimState;
	readonly cursor?: UnitOwnershipClaimCursorBoundary;
	readonly limit: number;
}) {
	const rows = await database
		.select({
			id: unitOwnershipClaim.id,
			unitId: unitOwnershipClaim.unitId,
			unitKind: unit.kind,
			unitTitle: firstUnitLocalizationTitle(unit.id),
			currentOwnerProfileId: activeOwnerProfileId(unit.id),
			claimantProfileId: unitOwnershipClaim.claimantProfileId,
			claimantLabel: firstUnitLocalizationTitle(unitOwnershipClaim.claimantProfileId),
			sourceOwnershipId: unitOwnershipClaim.sourceOwnershipId,
			details: unitOwnershipClaim.details,
			resolution: unitOwnershipClaim.resolution,
			resolvedAt: unitOwnershipClaim.resolvedAt,
			resolvedByProfileId: unitOwnershipClaim.resolvedByProfileId,
			resultingOwnershipId: unitOwnershipClaim.resultingOwnershipId,
			createdAt: unitOwnershipClaim.createdAt,
		})
		.from(unitOwnershipClaim)
		.innerJoin(unit, eq(unit.id, unitOwnershipClaim.unitId))
		.where(
			and(
				input.state === "pending"
					? isNull(unitOwnershipClaim.resolution)
					: input.state
						? eq(unitOwnershipClaim.resolution, input.state)
						: undefined,
				input.cursor
					? or(
							lt(unitOwnershipClaim.createdAt, input.cursor.createdAt),
							and(
								eq(unitOwnershipClaim.createdAt, input.cursor.createdAt),
								lt(unitOwnershipClaim.id, input.cursor.id),
							),
						)
					: undefined,
			),
		)
		.orderBy(desc(unitOwnershipClaim.createdAt), desc(unitOwnershipClaim.id))
		.limit(input.limit + 1);
	const items = rows.slice(0, input.limit).map((row) => ({
		...row,
		ownershipMode: unitOwnershipModeFromOwnerProfileId(row.currentOwnerProfileId),
		state: unitOwnershipClaimState(row),
	}));
	const last = items.at(-1);
	return {
		items,
		nextCursor:
			rows.length > input.limit && last ? { createdAt: last.createdAt, id: last.id } : null,
	};
}

async function notifyClaimDecision(
	tx: DatabaseTransaction,
	input: {
		readonly claimId: string;
		readonly unitId: string;
		readonly claimantProfileId: string;
		readonly actorProfileId: string;
		readonly resolution: Exclude<UnitOwnershipClaimResolution, "withdrawn">;
	},
) {
	await createNotification(tx, {
		kind: "system",
		recipientProfileId: input.claimantProfileId,
		actorProfileId: input.actorProfileId,
		subjectUnitId: input.unitId,
		dedupeKey: `unit-ownership-claim:${input.claimId}:${input.resolution}`,
		payload: {
			type: "system_event",
			event: "unit_ownership_claim_resolution",
			references: {
				claimId: input.claimId,
				resolution: input.resolution,
			},
		},
	});
}

export async function decidePlatformUnitOwnershipClaim(
	authorization: PlatformAuthorization<string>,
	input: {
		readonly claimId: string;
		readonly actorProfileId: string;
		readonly decision: UnitOwnershipClaimDecision;
		readonly rules: readonly GovernanceRuleReference[];
		readonly note?: string;
	},
) {
	return database.transaction(async (tx) => {
		await authorization.ensureCapability("unit.ownership.override", tx);
		const [initial] = await tx
			.select({ unitId: unitOwnershipClaim.unitId })
			.from(unitOwnershipClaim)
			.where(eq(unitOwnershipClaim.id, input.claimId))
			.limit(1);
		if (!initial) throw new UnitOwnershipClaimNotFound();
		await lockUnitAccessState(tx, [initial.unitId]);

		const [claim] = await tx
			.select()
			.from(unitOwnershipClaim)
			.where(eq(unitOwnershipClaim.id, input.claimId))
			.limit(1)
			.for("update");
		if (!claim) throw new UnitOwnershipClaimNotFound();
		if (claim.resolution !== null) throw new UnitOwnershipClaimChanged();
		if (claim.claimantProfileId === input.actorProfileId)
			throw new UnitOwnershipClaimSelfDecisionForbidden();
		const decision = await createGovernanceDecision(tx, {
			action: `unit.ownership_claim.${input.decision === "approved" ? "approve" : "reject"}`,
			actorProfileId: input.actorProfileId,
			authority: { kind: "platform" },
			targetUnitId: claim.unitId,
			subject: { kind: "unit_ownership_claim", id: claim.id },
			basis: { kind: "rules", rules: input.rules },
		});

		const now = new Date();
		if (input.decision === "rejected") {
			const [resolved] = await tx
				.update(unitOwnershipClaim)
				.set({
					resolution: "rejected",
					resolvedAt: now,
					resolvedByProfileId: input.actorProfileId,
					updatedAt: now,
				})
				.where(and(eq(unitOwnershipClaim.id, claim.id), isNull(unitOwnershipClaim.resolution)))
				.returning({ id: unitOwnershipClaim.id });
			if (!resolved) throw new UnitOwnershipClaimChanged();
			await recordAuditEvent(tx, {
				category: "admin_activity",
				outcome: "succeeded",
				actor: { kind: "profile", profileId: input.actorProfileId },
				authority: { kind: "platform" },
				action: "unit.ownership_claim.reject",
				governanceDecisionId: decision.id,
				target: {
					kind: "unit_ownership_claim",
					id: claim.id,
					path: claim.unitId,
				},
				details: {
					claimantProfileId: claim.claimantProfileId,
					...(input.note ? { note: input.note } : {}),
				},
			});
			await notifyClaimDecision(tx, {
				claimId: claim.id,
				unitId: claim.unitId,
				claimantProfileId: claim.claimantProfileId,
				actorProfileId: input.actorProfileId,
				resolution: "rejected",
			});
			return { id: claim.id, state: "rejected" as const, ownershipId: null };
		}

		const target = await loadClaimableUnit(tx, claim.unitId);
		if (!isUnitOwnershipClaimEligible(target)) throw new UnitOwnershipClaimChanged();
		const [sourceOwnership] = await tx
			.select({ id: unitOwnership.id })
			.from(unitOwnership)
			.where(
				and(
					eq(unitOwnership.id, claim.sourceOwnershipId),
					eq(unitOwnership.unitId, claim.unitId),
					eq(unitOwnership.profileId, OfficialProfileIds.community),
					isNull(unitOwnership.revokedAt),
				),
			)
			.limit(1)
			.for("update");
		if (!sourceOwnership) throw new UnitOwnershipClaimChanged();
		const [claimant] = await tx
			.select({ id: profile.id })
			.from(profile)
			.innerJoin(unit, eq(unit.id, profile.id))
			.where(and(eq(profile.id, claim.claimantProfileId), isNull(unit.deletedAt)))
			.limit(1);
		if (!claimant) throw new UnitOwnershipClaimChanged();

		const replaced = await replaceUnitOwnership(tx, {
			unitId: claim.unitId,
			expectedOwnerProfileId: OfficialProfileIds.community,
			targetProfileId: claim.claimantProfileId,
			actorProfileId: input.actorProfileId,
			now,
		});
		if (!replaced.ok) throw new UnitOwnershipClaimChanged();

		const [resolved] = await tx
			.update(unitOwnershipClaim)
			.set({
				resolution: "approved",
				resolvedAt: now,
				resolvedByProfileId: input.actorProfileId,
				resultingOwnershipId: replaced.ownershipId,
				updatedAt: now,
			})
			.where(and(eq(unitOwnershipClaim.id, claim.id), isNull(unitOwnershipClaim.resolution)))
			.returning({ id: unitOwnershipClaim.id });
		if (!resolved) throw new UnitOwnershipClaimChanged();

		const superseded = await tx
			.update(unitOwnershipClaim)
			.set({
				resolution: "superseded",
				resolvedAt: now,
				resolvedByProfileId: input.actorProfileId,
				updatedAt: now,
			})
			.where(
				and(
					eq(unitOwnershipClaim.unitId, claim.unitId),
					sql`${unitOwnershipClaim.id} <> ${claim.id}`,
					isNull(unitOwnershipClaim.resolution),
				),
			)
			.returning({
				id: unitOwnershipClaim.id,
				claimantProfileId: unitOwnershipClaim.claimantProfileId,
			});
		await recordUnitRevision(tx, {
			unitId: claim.unitId,
			actorProfileId: input.actorProfileId,
			event: "update",
			message: "Transfer community-owned Unit to approved claimant",
		});
		await recordAuditEvent(tx, {
			category: "admin_activity",
			outcome: "succeeded",
			actor: { kind: "profile", profileId: input.actorProfileId },
			authority: { kind: "platform" },
			action: "unit.ownership_claim.approve",
			governanceDecisionId: decision.id,
			target: {
				kind: "unit_ownership_claim",
				id: claim.id,
				path: claim.unitId,
			},
			details: {
				previousOwnerProfileId: OfficialProfileIds.community,
				ownerProfileId: claim.claimantProfileId,
				ownershipId: replaced.ownershipId,
				supersededClaimIds: superseded.map(({ id }) => id),
				...(input.note ? { note: input.note } : {}),
			},
		});
		await notifyClaimDecision(tx, {
			claimId: claim.id,
			unitId: claim.unitId,
			claimantProfileId: claim.claimantProfileId,
			actorProfileId: input.actorProfileId,
			resolution: "approved",
		});
		for (const other of superseded)
			await notifyClaimDecision(tx, {
				claimId: other.id,
				unitId: claim.unitId,
				claimantProfileId: other.claimantProfileId,
				actorProfileId: input.actorProfileId,
				resolution: "superseded",
			});
		return {
			id: claim.id,
			state: "approved" as const,
			ownershipId: replaced.ownershipId,
		};
	});
}
