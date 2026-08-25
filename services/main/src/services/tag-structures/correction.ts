import { and, eq, inArray, isNull, notInArray, sql } from "drizzle-orm";
import type { PlatformAuthorization } from "../authorization/platform/authorization";

import { VndbVoteHotKeyBusy } from "../database/errors";
import { database, type DatabaseExecutor, type DatabaseTransaction } from "../database";
import { databaseErrorMatches } from "../database/constraint";
import {
	entity,
	tag,
	unit,
	unitStructure,
	unitStructureCorrection,
	unitStructureCorrectionPolicy,
	type UnitStructureCorrectionStatus,
	type UnitStructureCorrectionWriteRoute,
	UnitStructureMaximumMembers,
	UnitStructureMinimumMembers,
} from "../database/schema";
import type {
	RevisionContributionInput,
	RevisionContributionRole,
	UnitRevisionPrimaryContributionKind,
} from "../units/revision-contribution";
import { RevisionCreditEntityInvalid } from "../units/errors";
import {
	InvalidTagStructure,
	TagNotFound,
	TagStructureChanged,
	TagStructureDefinitionConflict,
	TagStructureNotFound,
} from "../api/tags/errors";

const TerminalCorrectionStatuses = ["completed", "failed", "cancelled"] as const;

type StoredCorrection = typeof unitStructureCorrection.$inferSelect;

export type UnitStructureCorrectionJob = {
	readonly correctionId: string;
	readonly structureId: string;
	readonly changed: true;
	readonly sourceProjectionVersion: number;
	readonly targetProjectionVersion: number;
	readonly sourceMemberTagIds: string[];
	readonly targetMemberTagIds: string[];
	readonly status: UnitStructureCorrectionStatus;
	readonly writeRoute: UnitStructureCorrectionWriteRoute;
	readonly requestedAt: Date;
	readonly updatedAt: Date;
	readonly activatedAt: Date | null;
	readonly completedAt: Date | null;
	readonly failedAt: Date | null;
	readonly cancelledAt: Date | null;
	readonly lastErrorCode: string | null;
	readonly lastErrorMessage: string | null;
};

export type UnitStructureCorrectionSubmission =
	| UnitStructureCorrectionJob
	| {
			readonly correctionId: null;
			readonly structureId: string;
			readonly changed: false;
			readonly sourceProjectionVersion: number;
			readonly targetProjectionVersion: number;
			readonly sourceMemberTagIds: string[];
			readonly targetMemberTagIds: string[];
			readonly status: "completed";
			readonly writeRoute: "target";
			readonly requestedAt: Date;
			readonly updatedAt: Date;
			readonly activatedAt: null;
			readonly completedAt: Date;
			readonly failedAt: null;
			readonly cancelledAt: null;
			readonly lastErrorCode: null;
			readonly lastErrorMessage: null;
	  };

export type SubmitUnitStructureCorrectionInput = {
	readonly structureId: string;
	readonly memberTagIds: readonly string[];
	readonly expectedUpdatedAt: Date;
	readonly reason: string;
	readonly actorProfileId: string;
	readonly authorization: PlatformAuthorization<string>;
	readonly contribution?: RevisionContributionInput;
};

type StoredContribution = {
	readonly kind: UnitRevisionPrimaryContributionKind;
	readonly creditedEntityId: string | null;
	readonly role: RevisionContributionRole | null;
};

function presentCorrection(job: StoredCorrection): UnitStructureCorrectionJob {
	return {
		correctionId: job.id,
		structureId: job.structureId,
		changed: true,
		sourceProjectionVersion: job.sourceProjectionVersion,
		targetProjectionVersion: job.targetProjectionVersion,
		sourceMemberTagIds: [...job.sourceMemberUnitIds],
		targetMemberTagIds: [...job.targetMemberUnitIds],
		status: job.status,
		writeRoute: job.writeRoute,
		requestedAt: job.createdAt,
		updatedAt: job.updatedAt,
		activatedAt: job.activatedAt,
		completedAt: job.completedAt,
		failedAt: job.failedAt,
		cancelledAt: job.cancelledAt,
		lastErrorCode: job.lastErrorCode,
		lastErrorMessage: job.lastErrorMessage,
	};
}

function validateCorrectionInput(input: SubmitUnitStructureCorrectionInput): string {
	if (
		input.memberTagIds.length < UnitStructureMinimumMembers ||
		input.memberTagIds.length > UnitStructureMaximumMembers ||
		new Set(input.memberTagIds).size !== input.memberTagIds.length ||
		Number.isNaN(input.expectedUpdatedAt.getTime())
	)
		throw new InvalidTagStructure();
	const reason = input.reason.trim();
	if (!reason || reason.length > 500) throw new InvalidTagStructure();
	return reason;
}

function sameOrderedIds(left: readonly string[], right: readonly string[]): boolean {
	return left.length === right.length && left.every((id, index) => id === right[index]);
}

function structurePathKey(memberTagIds: readonly string[]): string {
	return JSON.stringify(["tag.hierarchy_path", ...memberTagIds]);
}

async function ensureCorrectionTags(
	tx: DatabaseTransaction,
	memberTagIds: readonly string[],
): Promise<void> {
	const rows = await tx
		.select({ id: tag.id })
		.from(tag)
		.innerJoin(unit, eq(unit.id, tag.id))
		.where(
			and(
				inArray(tag.id, [...memberTagIds]),
				eq(unit.kind, "tag"),
				eq(unit.status, "published"),
				eq(unit.visibility, "public"),
				eq(unit.moderationStatus, "approved"),
				isNull(unit.deletedAt),
			),
		);
	if (rows.length !== memberTagIds.length) throw new TagNotFound();
}

async function resolveStoredContribution(
	tx: DatabaseTransaction,
	input: RevisionContributionInput | undefined,
): Promise<StoredContribution> {
	const contribution = input ?? { primary: "unattributed" as const };
	if (contribution.primary !== "ai")
		return { kind: contribution.primary, creditedEntityId: null, role: null };
	const [eligible] = await tx
		.select({ id: entity.id })
		.from(entity)
		.innerJoin(unit, eq(unit.id, entity.id))
		.where(
			and(
				eq(entity.id, contribution.creditedEntityId),
				eq(entity.kind, "software_agent"),
				eq(unit.status, "published"),
				inArray(unit.visibility, ["public", "unlisted"]),
				eq(unit.moderationStatus, "approved"),
				isNull(unit.deletedAt),
			),
		)
		.limit(1);
	if (!eligible) throw new RevisionCreditEntityInvalid();
	return {
		kind: "ai",
		creditedEntityId: eligible.id,
		role: contribution.role,
	};
}

function presentNoChange(input: {
	readonly structureId: string;
	readonly projectionVersion: number;
	readonly memberTagIds: readonly string[];
	readonly updatedAt: Date;
}): UnitStructureCorrectionSubmission {
	return {
		correctionId: null,
		structureId: input.structureId,
		changed: false,
		sourceProjectionVersion: input.projectionVersion,
		targetProjectionVersion: input.projectionVersion,
		sourceMemberTagIds: [...input.memberTagIds],
		targetMemberTagIds: [...input.memberTagIds],
		status: "completed",
		writeRoute: "target",
		requestedAt: input.updatedAt,
		updatedAt: input.updatedAt,
		activatedAt: null,
		completedAt: input.updatedAt,
		failedAt: null,
		cancelledAt: null,
		lastErrorCode: null,
		lastErrorMessage: null,
	};
}

async function submitInTransaction(
	tx: DatabaseTransaction,
	input: SubmitUnitStructureCorrectionInput,
): Promise<UnitStructureCorrectionSubmission> {
	const reason = validateCorrectionInput(input);
	await input.authorization.ensureCapability("unit.edit", tx);
	const [current] = await tx
		.select({
			memberUnitIds: unitStructure.memberUnitIds,
			activeProjectionVersion: unitStructure.activeProjectionVersion,
			updatedAt: unitStructure.updatedAt,
		})
		.from(unitStructure)
		.where(eq(unitStructure.id, input.structureId))
		.limit(1)
		.for("update");
	if (!current) throw new TagStructureNotFound();
	if (current.updatedAt.getTime() !== input.expectedUpdatedAt.getTime())
		throw new TagStructureChanged(current.updatedAt);
	if (sameOrderedIds(current.memberUnitIds, input.memberTagIds))
		return presentNoChange({
			structureId: input.structureId,
			projectionVersion: current.activeProjectionVersion,
			memberTagIds: current.memberUnitIds,
			updatedAt: current.updatedAt,
		});

	const [existingOpen] = await tx
		.select()
		.from(unitStructureCorrection)
		.where(
			and(
				eq(unitStructureCorrection.structureId, input.structureId),
				notInArray(unitStructureCorrection.status, [...TerminalCorrectionStatuses]),
			),
		)
		.limit(1)
		.for("update");
	if (existingOpen) {
		if (sameOrderedIds(existingOpen.targetMemberUnitIds, input.memberTagIds))
			return presentCorrection(existingOpen);
		throw new TagStructureChanged(current.updatedAt);
	}

	const [policy] = await tx
		.select({
			admissionOpen: unitStructureCorrectionPolicy.admissionOpen,
			maximumPendingJobs: unitStructureCorrectionPolicy.maximumPendingJobs,
		})
		.from(unitStructureCorrectionPolicy)
		.where(eq(unitStructureCorrectionPolicy.id, true))
		.limit(1)
		.for("update");
	if (!policy?.admissionOpen) throw new VndbVoteHotKeyBusy();
	const [queue] = await tx
		.select({ openCount: sql<number>`count(*)` })
		.from(unitStructureCorrection)
		.where(notInArray(unitStructureCorrection.status, [...TerminalCorrectionStatuses]));
	if (Number(queue?.openCount ?? 0) >= policy.maximumPendingJobs) throw new VndbVoteHotKeyBusy();

	await ensureCorrectionTags(tx, input.memberTagIds);
	await tx.execute(
		sql`select pg_advisory_xact_lock(hashtextextended(${structurePathKey(input.memberTagIds)}, 0))`,
	);
	const [conflicting] = await tx
		.select({ id: unitStructure.id })
		.from(unitStructure)
		.where(
			and(
				eq(unitStructure.kind, "tag.hierarchy_path"),
				eq(unitStructure.definitionVersion, 1),
				eq(unitStructure.memberUnitIds, [...input.memberTagIds]),
			),
		)
		.limit(1);
	if (conflicting && conflicting.id !== input.structureId)
		throw new TagStructureDefinitionConflict(conflicting.id);
	const contribution = await resolveStoredContribution(tx, input.contribution);
	const [created] = await tx
		.insert(unitStructureCorrection)
		.values({
			structureId: input.structureId,
			sourceProjectionVersion: current.activeProjectionVersion,
			targetProjectionVersion: current.activeProjectionVersion + 1,
			sourceMemberUnitIds: current.memberUnitIds,
			targetMemberUnitIds: [...input.memberTagIds],
			expectedStructureUpdatedAt: current.updatedAt,
			requestedByProfileId: input.actorProfileId,
			reason,
			contributionKind: contribution.kind,
			creditedEntityId: contribution.creditedEntityId,
			contributionRole: contribution.role,
		})
		.returning();
	if (!created) throw new Error("Structure correction insertion did not return a job");
	return presentCorrection(created);
}

/** Persists only an immutable correction intent; preflight and reservations are worker-owned. */
export async function submitUnitStructureCorrection(
	input: SubmitUnitStructureCorrectionInput,
	tx?: DatabaseTransaction,
): Promise<UnitStructureCorrectionSubmission> {
	try {
		return tx
			? await submitInTransaction(tx, input)
			: await database.transaction((inner) => submitInTransaction(inner, input));
	} catch (error) {
		if (
			databaseErrorMatches(error, {
				code: "55P03",
				constraint: "unit_structure_correction_frozen",
			})
		)
			throw new VndbVoteHotKeyBusy(error);
		throw error;
	}
}

/** Reads one durable correction without exposing another Structure's job ID. */
export async function getUnitStructureCorrection(
	structureId: string,
	correctionId: string,
	executor: DatabaseExecutor = database,
): Promise<UnitStructureCorrectionJob> {
	const [job] = await executor
		.select()
		.from(unitStructureCorrection)
		.where(
			and(
				eq(unitStructureCorrection.id, correctionId),
				eq(unitStructureCorrection.structureId, structureId),
			),
		)
		.limit(1);
	if (!job) throw new TagStructureNotFound();
	return presentCorrection(job);
}
