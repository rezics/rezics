import { and, desc, eq, gt, inArray, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { CatalogReferenceSchema, type UnitOwner } from "@rezics/reference";
import type { Authorization } from "../authorization";
import type { PlatformAuthorization } from "../authorization/platform/authorization";
import {
	UnitAlreadyDeleted,
	UnitLifecycleChanged,
	UnitLifecycleProtected,
	UnitMergeRequestConflict,
	UnitNotDeleted,
} from "../api/governance/errors";
import { recordAuditEvent } from "../audit";
import { BootstrapUnitIds, BootstrapEntityIds } from "../bootstrap/data";
import { database, type DatabaseTransaction } from "../database";
import {
	entityParticipation,
	catalogUnitLocator,
	governanceDecision,
	unitMergeGraphLock,
	unitMergeRedirect,
	unitOwnership,
} from "../database/schema";
import { CatalogFactTables } from "../database/schema/catalog-facts";
import { unitOwnerTable } from "../database/schema/unit-reference-columns";
import {
	createGovernanceDecision,
	type GovernanceRuleReference,
} from "../governance/decision-service";
import { UnitNotFound } from "./errors";
import { recordUnitRevision } from "./history";
import { readUnitStateById, type UnitState } from "./query";
import { unitStateRelation } from "./state-relation";
import { readUnitPresentationsInTransaction } from "./presentation-reader";
import { nextUnitUpdatedAt } from "./update-values";
import type { RevisionContributionInput } from "./revision-contribution";
import { transitionUnitStatus } from "./status";
import { resolveGovernanceLookup } from "./governance-lookup";

const ProtectedUnitIds: ReadonlySet<string> = new Set([...BootstrapUnitIds, ...BootstrapEntityIds]);
export type PlatformUnitLifecycleState = "active" | "deleted" | "all";
export interface PlatformUnitLifecycleItem {
	readonly id: string;
	readonly owner: UnitOwner;
	readonly shape: string;
	readonly title: string | null;
	readonly status: UnitState["status"];
	readonly ownership: {
		readonly entityId: string;
		readonly label: string | null;
	} | null;
	readonly deletedAt: Date | null;
	readonly updatedAt: Date;
	readonly protected: boolean;
}
async function protectedIdentity(tx: DatabaseTransaction, id: string) {
	if (ProtectedUnitIds.has(id)) return true;
	const [self] = await tx
		.select({ id: entityParticipation.entityId })
		.from(entityParticipation)
		.where(and(eq(entityParticipation.entityId, id)))
		.limit(1);
	return Boolean(self);
}
async function present(
	tx: DatabaseTransaction,
	rows: readonly UnitState[],
): Promise<PlatformUnitLifecycleItem[]> {
	const ids = rows.map((row) => row.id),
		presentations = await readUnitPresentationsInTransaction(tx, ids, [], {
			includeDeleted: true,
		});
	const ownerships = ids.length
		? await tx
				.select({
					unitId: unitOwnership.unitId,
					entityId: unitOwnership.profileId,
				})
				.from(unitOwnership)
				.where(and(inArray(unitOwnership.unitId, ids), isNull(unitOwnership.revokedAt)))
				.limit(ids.length)
		: [];
	const owners = await readUnitPresentationsInTransaction(
			tx,
			[...new Set(ownerships.map((row) => row.entityId))],
			[],
			{ includeDeleted: true },
		),
		byUnit = new Map(ownerships.map((row) => [row.unitId, row.entityId]));
	const selfBindings = ids.length
		? await tx
				.select({ id: entityParticipation.entityId })
				.from(entityParticipation)
				.where(and(inArray(entityParticipation.entityId, ids)))
				.limit(ids.length)
		: [];
	const selves = new Set(selfBindings.map((row) => row.id));
	return rows.map((row) => {
		const ownerId = byUnit.get(row.id);
		return {
			id: row.id,
			owner: row.reference.owner,
			shape: row.shape,
			title: presentations.get(row.id)?.title ?? null,
			status: row.status,
			ownership: ownerId
				? {
						entityId: ownerId,
						label: owners.get(ownerId)?.title ?? null,
					}
				: null,
			deletedAt: row.deletedAt,
			updatedAt: row.updatedAt,
			protected: ProtectedUnitIds.has(row.id) || selves.has(row.id),
		};
	});
}
/** Native registry browsing caps candidates before state/name hydration; cursors advance across filtered records. */
export async function listPlatformUnits(
	authorization: PlatformAuthorization<string | undefined>,
	input: {
		readonly state: PlatformUnitLifecycleState;
		readonly query?: string;
		readonly scopeNamespaceId?: string;
		readonly scopeUnitId?: string;
		readonly cursor?: string;
		readonly limit: number;
	},
) {
	const limit = z.number().int().min(1).max(100).parse(input.limit);
	return database.transaction(
		async (tx) => {
			await authorization.ensureCapability("unit.governance.read", tx);
			const lookup = await resolveGovernanceLookup(tx, input);
			const candidates =
				lookup.kind === "exact"
					? input.cursor || !lookup.id
						? []
						: [{ id: lookup.id }]
					: await tx
							.select({ id: catalogUnitLocator.id })
							.from(catalogUnitLocator)
							.where(
								input.cursor ? gt(catalogUnitLocator.id, z.uuid().parse(input.cursor)) : undefined,
							)
							.orderBy(catalogUnitLocator.id)
							.limit(Math.min(500, limit * 5));
			if (!candidates.length) return { items: [], nextCursor: null };
			const candidateIds = candidates.map((row) => row.id),
				state = unitStateRelation(catalogUnitLocator.id, "lifecycle_state", true);
			const states = await tx
				.select({
					id: state.id,
					owner: state.owner,
					shape: state.shape,
					status: state.status,
					visibility: state.visibility,
					contentRating: state.contentRating,
					moderationStatus: state.moderationStatus,
					aiDisclosure: state.aiDisclosure,
					postTargetingLocked: state.postTargetingLocked,
					publishedAt: state.publishedAt,
					revision: state.revision,
					routingGeneration: state.routingGeneration,
					createdByAuthUserId: state.createdByAuthUserId,
					deletedAt: state.deletedAt,
					createdAt: state.createdAt,
					updatedAt: state.updatedAt,
				})
				.from(catalogUnitLocator)
				.innerJoinLateral(state, sql`true`)
				.where(inArray(catalogUnitLocator.id, candidateIds))
				.orderBy(catalogUnitLocator.id)
				.limit(candidateIds.length);
			const eligible = states
				.filter(
					(row) =>
						input.state === "all" ||
						(input.state === "active" ? row.deletedAt === null : row.deletedAt !== null),
				)
				.map(({ owner, ...row }) => ({
					...row,
					reference: { owner, id: row.id },
				}));
			const items = await present(tx, eligible.slice(0, limit + 1));
			const matching = items;
			const page = matching.slice(0, limit),
				full = candidates.length === Math.min(500, limit * 5);
			return {
				items: page,
				nextCursor:
					matching.length > limit
						? (page.at(-1)?.id ?? null)
						: lookup.kind === "browse" && full
							? (candidates.at(-1)?.id ?? null)
							: null,
			};
		},
		{ isolationLevel: "repeatable read" },
	);
}
export async function getPlatformUnit(
	authorization: PlatformAuthorization<string | undefined>,
	unitId: string,
): Promise<PlatformUnitLifecycleItem> {
	return database.transaction(
		async (tx) => {
			await authorization.ensureCapability("unit.governance.read", tx);
			const state = await readUnitStateById(tx, unitId, {
				includeDeleted: true,
			});
			if (!state) throw new UnitNotFound();
			const [item] = await present(tx, [state]);
			if (!item) throw new UnitNotFound();
			return item;
		},
		{ isolationLevel: "repeatable read" },
	);
}
async function lockUnit(tx: DatabaseTransaction, id: string) {
	const state = await readUnitStateById(tx, id, {
		includeDeleted: true,
		lock: "update",
	});
	if (!state) throw new UnitNotFound();
	return state;
}
async function ensureNoMerge(tx: DatabaseTransaction, id: string) {
	const [lock] = await tx
		.select({ id: unitMergeGraphLock.unitId })
		.from(unitMergeGraphLock)
		.where(eq(unitMergeGraphLock.unitId, id))
		.limit(1);
	if (lock) throw new UnitMergeRequestConflict();
}
async function lockMerge(tx: DatabaseTransaction, id: string) {
	await tx.execute(
		sql`select pg_advisory_xact_lock(hashtextextended('unit-merge:'||${id}::text,0))`,
	);
}
async function audit(
	tx: DatabaseTransaction,
	authorization: Authorization,
	input: {
		unitId: string;
		action: "unit.delete" | "unit.restore";
		decisionId: string;
		note?: string;
		previousStatus: UnitState["status"];
		resultingStatus: UnitState["status"];
	},
) {
	if (!authorization.authUserId) throw new UnitLifecycleProtected();
	await recordAuditEvent(tx, {
		category: "admin_activity",
		outcome: "succeeded",
		actor: { kind: "auth", authUserId: authorization.authUserId },
		authority: { kind: "platform" },
		action: input.action,
		governanceDecisionId: input.decisionId,
		target: { kind: "unit", id: input.unitId },
		details: {
			previousStatus: input.previousStatus,
			resultingStatus: input.resultingStatus,
			...(input.note ? { note: input.note } : {}),
		},
	});
}
async function writeLifecycle(
	tx: DatabaseTransaction,
	authorization: Authorization,
	current: UnitState,
	input: {
		deletedAt: Date | null;
		status: UnitState["status"];
		action: "delete" | "restore";
		contribution?: RevisionContributionInput;
	},
) {
	const table = unitOwnerTable(current.reference.owner),
		now = nextUnitUpdatedAt(current.updatedAt),
		native = CatalogReferenceSchema.safeParse(current.reference);
	const immediateStatus =
		!native.success && input.action === "restore" ? current.status : input.status;
	const [changed] = await tx
		.update(table)
		.set({
			deletedAt: input.deletedAt,
			status: immediateStatus,
			updatedAt: now,
			revision: sql`${table.revision}+1`,
		})
		.where(and(eq(table.id, current.id), eq(table.revision, current.revision)))
		.returning({ revision: table.revision });
	if (!changed) throw new UnitLifecycleChanged();
	if (native.success) {
		if (!authorization.authUserId) throw new UnitLifecycleProtected();
		await tx.insert(CatalogFactTables[native.data.owner].change).values({
			ownerId: current.id,
			version: changed.revision,
			actorAuthUserId: authorization.authUserId,
			operation: `platform.lifecycle.${input.action}`,
		});
	} else {
		const revision = await recordUnitRevision(tx, {
			unitId: current.id,
			actorProfileId: authorization.profileId,
			contribution: input.contribution,
			event: input.action,
		});
		if (input.status !== immediateStatus) {
			if (!authorization.profileId) throw new UnitLifecycleProtected();
			await transitionUnitStatus(tx, {
				unitId: current.id,
				toStatus: input.status,
				actor: { kind: "profile", profileId: authorization.profileId },
				authorization: { kind: "trusted" },
				revisionId: revision.revisionId,
			});
		}
	}
}
export async function softDeletePlatformUnit(
	authorization: Authorization,
	input: {
		readonly unitId: string;
		readonly expectedUpdatedAt: Date;
		readonly rules: readonly GovernanceRuleReference[];
		readonly note?: string;
		readonly contribution?: RevisionContributionInput;
	},
): Promise<PlatformUnitLifecycleItem> {
	return database.transaction(async (tx) => {
		await authorization.platform.ensureCapability("unit.delete", tx);
		if (!authorization.profileId || !authorization.authUserId) throw new UnitLifecycleProtected();
		await lockMerge(tx, input.unitId);
		const current = await lockUnit(tx, input.unitId);
		await ensureNoMerge(tx, current.id);
		if (await protectedIdentity(tx, current.id)) throw new UnitLifecycleProtected();
		if (current.updatedAt.getTime() !== input.expectedUpdatedAt.getTime())
			throw new UnitLifecycleChanged();
		if (current.deletedAt) throw new UnitAlreadyDeleted();
		const decision = await createGovernanceDecision(tx, {
			action: "unit.delete",
			actorProfileId: authorization.profileId,
			authority: { kind: "platform" },
			targetUnitId: current.id,
			subject: { kind: "unit", id: current.id },
			basis: { kind: "rules", rules: input.rules },
		});
		await writeLifecycle(tx, authorization, current, {
			deletedAt: new Date(),
			status: current.status,
			action: "delete",
			contribution: input.contribution,
		});
		await audit(tx, authorization, {
			unitId: current.id,
			action: "unit.delete",
			decisionId: decision.id,
			note: input.note,
			previousStatus: current.status,
			resultingStatus: current.status,
		});
		const [result] = await present(tx, [await lockUnit(tx, current.id)]);
		if (!result) throw new UnitNotFound();
		return result;
	});
}
export async function restorePlatformUnit(
	authorization: Authorization,
	input: {
		readonly unitId: string;
		readonly expectedUpdatedAt: Date;
		readonly note?: string;
		readonly contribution?: RevisionContributionInput;
	},
): Promise<PlatformUnitLifecycleItem> {
	return database.transaction(async (tx) => {
		await authorization.platform.ensureCapability("unit.restore", tx);
		if (!authorization.profileId || !authorization.authUserId) throw new UnitLifecycleProtected();
		await lockMerge(tx, input.unitId);
		const current = await lockUnit(tx, input.unitId);
		await ensureNoMerge(tx, current.id);
		if (current.updatedAt.getTime() !== input.expectedUpdatedAt.getTime())
			throw new UnitLifecycleChanged();
		if (!current.deletedAt) throw new UnitNotDeleted();
		const [redirect] = await tx
			.select({ id: unitMergeRedirect.sourceUnitId })
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
			actorProfileId: authorization.profileId,
			authority: { kind: "platform" },
			targetUnitId: current.id,
			subject: { kind: "unit", id: current.id },
			basis: { kind: "reversal", reversesDecisionId: deletedBy.id },
		});
		const status = current.status === "published" ? "archived" : current.status;
		// Restore does not republish an item. Native catalog and platform ledgers remain separate.
		await writeLifecycle(tx, authorization, current, {
			deletedAt: null,
			status,
			action: "restore",
			contribution: input.contribution,
		});
		await audit(tx, authorization, {
			unitId: current.id,
			action: "unit.restore",
			decisionId: decision.id,
			note: input.note,
			previousStatus: current.status,
			resultingStatus: status,
		});
		const [result] = await present(tx, [await lockUnit(tx, current.id)]);
		if (!result) throw new UnitNotFound();
		return result;
	});
}
