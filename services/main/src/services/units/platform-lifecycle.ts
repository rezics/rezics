import { and, desc, eq, gt, inArray, isNotNull, isNull, or, sql } from "drizzle-orm";

import { recordAuditEvent } from "../audit";
import { BootstrapUnitIds } from "../bootstrap/manifest";
import { database, type DatabaseExecutor, type DatabaseTransaction } from "../database";
import {
	profile,
	governanceDecision,
	unit,
	unitMergeGraphLock,
	unitMergeRedirect,
	unitOwnership,
	unitSlugAddress,
} from "../database/schema";
import { type UnitKind, UnitStatusValues } from "../database/schema/contract-values";
import {
	createGovernanceDecision,
	type GovernanceRuleReference,
} from "../governance/decision-service";
import {
	UnitAlreadyDeleted,
	UnitLifecycleChanged,
	UnitLifecycleProtected,
	UnitMergeRequestConflict,
	UnitNotDeleted,
} from "../api/governance/errors";
import { UnitNotFound } from "./errors";
import { recordUnitRevision } from "./history";
import { firstUnitLocalizationTitle } from "./localization";
import { transitionUnitStatus } from "./status";
import { ensureUnitVariantLifecycle } from "./variant-policy";

const ProtectedUnitIds: ReadonlySet<string> = new Set(BootstrapUnitIds);
type UnitStatus = (typeof UnitStatusValues)[number];

export type PlatformUnitLifecycleState = "active" | "deleted" | "all";

export interface PlatformUnitLifecycleItem {
	readonly id: string;
	readonly kind: UnitKind;
	readonly title: string | null;
	readonly status: UnitStatus;
	readonly owner: {
		readonly profileId: string;
		readonly label: string | null;
	} | null;
	readonly deletedAt: Date | null;
	readonly updatedAt: Date;
	readonly protected: boolean;
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

async function presentPlatformUnits<
	T extends {
		readonly id: string;
		readonly kind: UnitKind;
		readonly title: string | null;
		readonly status: UnitStatus;
		readonly ownerProfileId: string | null;
		readonly deletedAt: Date | null;
		readonly updatedAt: Date;
	},
>(executor: DatabaseExecutor, rows: readonly T[]) {
	const ownerIds = [
		...new Set(rows.flatMap((row) => (row.ownerProfileId ? [row.ownerProfileId] : []))),
	];
	const owners = ownerIds.length
		? await executor
				.select({
					profileId: profile.id,
					label: firstUnitLocalizationTitle(profile.id),
				})
				.from(profile)
				.where(inArray(profile.id, ownerIds))
		: [];
	const ownerById = new Map(owners.map((owner) => [owner.profileId, owner]));
	return rows.map(
		(row): PlatformUnitLifecycleItem => ({
			id: row.id,
			kind: row.kind,
			title: row.title,
			status: row.status,
			owner: row.ownerProfileId ? (ownerById.get(row.ownerProfileId) ?? null) : null,
			deletedAt: row.deletedAt,
			updatedAt: row.updatedAt,
			protected: ProtectedUnitIds.has(row.id),
		}),
	);
}

export async function listPlatformUnits(input: {
	readonly state: PlatformUnitLifecycleState;
	readonly query?: string;
	readonly cursor?: string;
	readonly limit: number;
}) {
	const search = input.query?.trim();
	const rows = await database
		.select({
			id: unit.id,
			kind: unit.kind,
			title: firstUnitLocalizationTitle(unit.id),
			status: unit.status,
			ownerProfileId: activeOwnerProfileId(unit.id),
			deletedAt: unit.deletedAt,
			updatedAt: unit.updatedAt,
		})
		.from(unit)
		.where(
			and(
				input.state === "active"
					? isNull(unit.deletedAt)
					: input.state === "deleted"
						? isNotNull(unit.deletedAt)
						: undefined,
				input.cursor ? gt(unit.id, input.cursor) : undefined,
				search
					? or(
							sql`${unit.id}::text ilike ${`%${search}%`}`,
							sql`coalesce(${firstUnitLocalizationTitle(unit.id)}, '') ilike ${`%${search}%`}`,
							sql`exists(
								select 1
								from ${unitSlugAddress}
								where ${unitSlugAddress.targetUnitId} = ${unit.id}
									and ${unitSlugAddress.kind} = 'canonical'
									and ${unitSlugAddress.slug} ilike ${`%${search}%`}
							)`,
						)
					: undefined,
			),
		)
		.orderBy(unit.id)
		.limit(input.limit + 1);
	const page = rows.slice(0, input.limit);
	return {
		items: await presentPlatformUnits(database, page),
		nextCursor: rows.length > input.limit ? (page.at(-1)?.id ?? null) : null,
	};
}

async function lockPlatformUnit(tx: DatabaseTransaction, unitId: string) {
	const [record] = await tx
		.select({
			id: unit.id,
			kind: unit.kind,
			title: firstUnitLocalizationTitle(unit.id),
			status: unit.status,
			ownerProfileId: activeOwnerProfileId(unit.id),
			deletedAt: unit.deletedAt,
			updatedAt: unit.updatedAt,
		})
		.from(unit)
		.where(eq(unit.id, unitId))
		.limit(1)
		.for("update");
	if (!record) throw new UnitNotFound();
	return record;
}

function ensureExpectedUpdatedAt(current: Date, expected: Date): void {
	if (current.getTime() !== expected.getTime()) throw new UnitLifecycleChanged();
}

function ensureDeletable(unitId: string, actorProfileId: string): void {
	if (unitId === actorProfileId || ProtectedUnitIds.has(unitId)) throw new UnitLifecycleProtected();
}

async function recordLifecycleAudit(
	tx: DatabaseTransaction,
	input: {
		readonly actorProfileId: string;
		readonly action: "unit.delete" | "unit.restore";
		readonly unitId: string;
		readonly governanceDecisionId: string;
		readonly note?: string;
		readonly previousStatus: UnitStatus;
		readonly resultingStatus: UnitStatus;
	},
) {
	await recordAuditEvent(tx, {
		category: "admin_activity",
		outcome: "succeeded",
		actor: { kind: "profile", profileId: input.actorProfileId },
		authority: { kind: "platform" },
		action: input.action,
		governanceDecisionId: input.governanceDecisionId,
		target: { kind: "unit", id: input.unitId },
		details: {
			previousStatus: input.previousStatus,
			resultingStatus: input.resultingStatus,
			...(input.note ? { note: input.note } : {}),
		},
	});
}

async function ensureNoActiveUnitMerge(tx: DatabaseTransaction, unitId: string): Promise<void> {
	const [mergeLock] = await tx
		.select({ unitId: unitMergeGraphLock.unitId })
		.from(unitMergeGraphLock)
		.where(eq(unitMergeGraphLock.unitId, unitId))
		.limit(1);
	if (mergeLock) throw new UnitMergeRequestConflict();
}

async function lockUnitMergeIdentity(tx: DatabaseTransaction, unitId: string): Promise<void> {
	await tx.execute(
		sql`select pg_advisory_xact_lock(hashtextextended('unit-merge:' || ${unitId}::text, 0))`,
	);
}

export async function softDeletePlatformUnit(input: {
	readonly unitId: string;
	readonly actorProfileId: string;
	readonly expectedUpdatedAt: Date;
	readonly rules: readonly GovernanceRuleReference[];
	readonly note?: string;
}): Promise<PlatformUnitLifecycleItem> {
	return database.transaction(async (tx) => {
		await lockUnitMergeIdentity(tx, input.unitId);
		const current = await lockPlatformUnit(tx, input.unitId);
		await ensureNoActiveUnitMerge(tx, current.id);
		ensureDeletable(current.id, input.actorProfileId);
		ensureExpectedUpdatedAt(current.updatedAt, input.expectedUpdatedAt);
		if (current.deletedAt) throw new UnitAlreadyDeleted();
		const decision = await createGovernanceDecision(tx, {
			action: "unit.delete",
			actorProfileId: input.actorProfileId,
			authority: { kind: "platform" },
			targetUnitId: current.id,
			subject: { kind: "unit", id: current.id },
			basis: { kind: "rules", rules: input.rules },
		});

		const now = new Date();
		await tx
			.update(unit)
			.set({ deletedAt: now, updatedAt: now })
			.where(and(eq(unit.id, current.id), isNull(unit.deletedAt)));
		await recordUnitRevision(tx, {
			unitId: current.id,
			actorProfileId: input.actorProfileId,
			event: "delete",
		});
		if (current.kind === "book" || current.kind === "software" || current.kind === "media")
			await ensureUnitVariantLifecycle(tx, current.id);
		await recordLifecycleAudit(tx, {
			actorProfileId: input.actorProfileId,
			action: "unit.delete",
			unitId: current.id,
			governanceDecisionId: decision.id,
			note: input.note,
			previousStatus: current.status,
			resultingStatus: current.status,
		});
		const resulting = await lockPlatformUnit(tx, current.id);
		const [presented] = await presentPlatformUnits(tx, [resulting]);
		if (!presented) throw new Error("Soft-deleted Unit presentation returned no row");
		return presented;
	});
}

export async function restorePlatformUnit(input: {
	readonly unitId: string;
	readonly actorProfileId: string;
	readonly expectedUpdatedAt: Date;
	readonly note?: string;
}): Promise<PlatformUnitLifecycleItem> {
	return database.transaction(async (tx) => {
		await lockUnitMergeIdentity(tx, input.unitId);
		const current = await lockPlatformUnit(tx, input.unitId);
		await ensureNoActiveUnitMerge(tx, current.id);
		ensureExpectedUpdatedAt(current.updatedAt, input.expectedUpdatedAt);
		if (!current.deletedAt) throw new UnitNotDeleted();
		const [redirect] = await tx
			.select({ sourceUnitId: unitMergeRedirect.sourceUnitId })
			.from(unitMergeRedirect)
			.where(eq(unitMergeRedirect.sourceUnitId, current.id))
			.limit(1);
		if (redirect) throw new UnitMergeRequestConflict();
		const [deletedBy] = await tx
			.select({ id: governanceDecision.id })
			.from(governanceDecision)
			.where(
				and(
					eq(governanceDecision.action, "unit.delete"),
					eq(governanceDecision.subjectKind, "unit"),
					eq(governanceDecision.subjectId, current.id),
				),
			)
			.orderBy(desc(governanceDecision.createdAt), desc(governanceDecision.id))
			.limit(1);
		if (!deletedBy) throw new UnitNotDeleted();
		const decision = await createGovernanceDecision(tx, {
			action: "unit.restore",
			actorProfileId: input.actorProfileId,
			authority: { kind: "platform" },
			targetUnitId: current.id,
			subject: { kind: "unit", id: current.id },
			basis: { kind: "reversal", reversesDecisionId: deletedBy.id },
		});

		const now = new Date();
		await tx
			.update(unit)
			.set({ deletedAt: null, updatedAt: now })
			.where(and(eq(unit.id, current.id), isNotNull(unit.deletedAt)));
		const revision = await recordUnitRevision(tx, {
			unitId: current.id,
			actorProfileId: input.actorProfileId,
			event: "restore",
		});
		const resultingStatus = current.status === "published" ? "archived" : current.status;
		if (resultingStatus !== current.status)
			await transitionUnitStatus(tx, {
				unitId: current.id,
				toStatus: resultingStatus,
				actor: { kind: "profile", profileId: input.actorProfileId },
				authorization: { kind: "trusted" },
				revisionId: revision.revisionId,
			});
		else if (current.kind === "book" || current.kind === "software" || current.kind === "media")
			await ensureUnitVariantLifecycle(tx, current.id);
		await recordLifecycleAudit(tx, {
			actorProfileId: input.actorProfileId,
			action: "unit.restore",
			unitId: current.id,
			governanceDecisionId: decision.id,
			note: input.note,
			previousStatus: current.status,
			resultingStatus,
		});
		const resulting = await lockPlatformUnit(tx, current.id);
		const [presented] = await presentPlatformUnits(tx, [resulting]);
		if (!presented) throw new Error("Restored Unit presentation returned no row");
		return presented;
	});
}
