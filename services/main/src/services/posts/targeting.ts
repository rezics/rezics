import { and, eq, inArray, sql } from "drizzle-orm";

import type { DatabaseExecutor, DatabaseTransaction } from "../database";
import { databaseConstraintName } from "../database/constraint";
import { post, postReply, realmUnit, unit } from "../database/schema";
import {
	PostTargetingLocked,
	type PostTargetRelation,
	type PostTargetingLockDetails,
} from "./errors";

const PostTargetingAdvisoryLockNamespace = 4;
const RelationOrder = {
	subject: 0,
	root: 1,
	parent: 2,
} as const satisfies Record<PostTargetRelation, number>;

type PostTarget = {
	readonly relation: PostTargetRelation;
	readonly unitId: string;
};

function normalizeTargets(targets: readonly PostTarget[]): readonly PostTarget[] {
	return [...targets]
		.filter(
			(target, index, all) =>
				all.findIndex(
					(candidate) =>
						candidate.unitId === target.unitId &&
						candidate.relation === target.relation,
				) === index,
		)
		.sort(
			(left, right) =>
				left.unitId.localeCompare(right.unitId) ||
				RelationOrder[left.relation] - RelationOrder[right.relation],
		);
}

function relationFor(targets: readonly PostTarget[], unitId: string): PostTargetRelation {
	const relation = targets.find((target) => target.unitId === unitId)?.relation;
	if (!relation) throw new Error(`Missing Post target relation for Unit ${unitId}`);
	return relation;
}

async function lockPostTargetingSource(
	tx: DatabaseTransaction,
	sourcePostId: string,
): Promise<void> {
	await tx.execute(
		sql`select pg_advisory_xact_lock(hashtextextended(${sourcePostId}::text, ${PostTargetingAdvisoryLockNamespace}))`,
	);
}

// Post Targeting Lock currently applies to every Post kind.
//
// ```progress
// id: posts.targeting-kind-policy
// status: open
// goal: Define and enforce targeting-lock behavior for every supported Post kind.
// depends: []
// accept:
//   - The Post-kind contract states which targeting relations each kind may create and which global or Realm locks apply.
//   - Structural and governance Post kinds cannot bypass a lock or inherit ordinary discussion behavior accidentally.
//   - API errors and authorization checks preserve the same policy for create, retarget, and restore paths.
//   - Existing ordinary Posts keep their supported targeting behavior.
// verify:
//   - Exercise allowed and denied targeting for every Post kind at global and Realm scope.
//   - Exercise create, retarget, restore, concurrent mutation, and unauthorized caller cases.
//   - Run the Posts service and API tests.
// ```
async function ensurePostTargetingAllowed(
	tx: DatabaseTransaction,
	input: {
		readonly sourcePostId: string;
		readonly targets: readonly PostTarget[];
		readonly realmIds?: readonly string[];
	},
): Promise<void> {
	const targets = normalizeTargets(input.targets);
	if (!targets.length) return;
	await lockPostTargetingSource(tx, input.sourcePostId);

	const targetIds = [...new Set(targets.map((target) => target.unitId))].sort();
	const globalTargets = await tx
		.select({ id: unit.id, postTargetingLocked: unit.postTargetingLocked })
		.from(unit)
		.where(inArray(unit.id, targetIds))
		.orderBy(unit.id)
		.for("share");
	const globalLock = globalTargets.find((target) => target.postTargetingLocked);
	if (globalLock)
		throw new PostTargetingLocked({
			scope: "global",
			relation: relationFor(targets, globalLock.id),
			targetUnitId: globalLock.id,
		});

	const mountedRealms = await tx
		.select({ realmId: realmUnit.realmId })
		.from(realmUnit)
		.where(
			and(eq(realmUnit.unitId, input.sourcePostId), eq(realmUnit.publicationState, "active")),
		)
		.orderBy(realmUnit.realmId);
	const realmIds = [
		...new Set([...mountedRealms.map((row) => row.realmId), ...(input.realmIds ?? [])]),
	].sort();
	if (!realmIds.length) return;

	const realmTargets = await tx
		.select({
			realmId: realmUnit.realmId,
			unitId: realmUnit.unitId,
			postTargetingLocked: realmUnit.postTargetingLocked,
		})
		.from(realmUnit)
		.where(
			and(
				inArray(realmUnit.realmId, realmIds),
				inArray(realmUnit.unitId, targetIds),
				eq(realmUnit.publicationState, "active"),
			),
		)
		.orderBy(realmUnit.realmId, realmUnit.unitId)
		.for("share");
	const realmLock = realmTargets.find((target) => target.postTargetingLocked);
	if (realmLock)
		throw new PostTargetingLocked({
			scope: "realm",
			relation: relationFor(targets, realmLock.unitId),
			targetUnitId: realmLock.unitId,
			realmId: realmLock.realmId,
		});
}

export async function ensureSubjectPostTargetingAllowed(
	tx: DatabaseTransaction,
	input: {
		readonly sourcePostId: string;
		readonly subjectUnitId?: string | null;
		readonly realmIds?: readonly string[];
	},
): Promise<void> {
	return ensurePostTargetingAllowed(tx, {
		sourcePostId: input.sourcePostId,
		targets: input.subjectUnitId ? [{ relation: "subject", unitId: input.subjectUnitId }] : [],
		...(input.realmIds ? { realmIds: input.realmIds } : {}),
	});
}

export async function ensureReplyPostTargetingAllowed(
	tx: DatabaseTransaction,
	input: {
		readonly sourcePostId: string;
		readonly rootPostId: string;
		readonly parentPostId?: string | null;
		readonly realmId?: string;
	},
): Promise<void> {
	return ensurePostTargetingAllowed(tx, {
		sourcePostId: input.sourcePostId,
		targets: [
			{ relation: "root", unitId: input.rootPostId },
			...(input.parentPostId
				? [{ relation: "parent" as const, unitId: input.parentPostId }]
				: []),
		],
		...(input.realmId ? { realmIds: [input.realmId] } : {}),
	});
}

export async function ensurePostMountTargetingAllowed(
	tx: DatabaseTransaction,
	input: { readonly postId: string; readonly realmIds: readonly string[] },
): Promise<void> {
	const [stored] = await tx
		.select({
			subjectUnitId: post.subjectUnitId,
			rootPostId: postReply.rootPostId,
			parentPostId: postReply.parentPostId,
		})
		.from(post)
		.leftJoin(postReply, eq(postReply.postId, post.id))
		.where(eq(post.id, input.postId))
		.limit(1);
	if (!stored) throw new Error(`Cannot mount missing Post ${input.postId}`);
	return ensurePostTargetingAllowed(tx, {
		sourcePostId: input.postId,
		targets: [
			...(stored.subjectUnitId
				? [{ relation: "subject" as const, unitId: stored.subjectUnitId }]
				: []),
			...(stored.rootPostId
				? [{ relation: "root" as const, unitId: stored.rootPostId }]
				: []),
			...(stored.parentPostId
				? [{ relation: "parent" as const, unitId: stored.parentPostId }]
				: []),
		],
		realmIds: input.realmIds,
	});
}

export async function findPostTargetingLock(
	executor: DatabaseExecutor,
	input: { readonly targets: readonly PostTarget[]; readonly realmId?: string },
): Promise<PostTargetingLockDetails | null> {
	const targets = normalizeTargets(input.targets);
	if (!targets.length) return null;
	const targetIds = [...new Set(targets.map((target) => target.unitId))].sort();
	const globalTargets = await executor
		.select({ id: unit.id, postTargetingLocked: unit.postTargetingLocked })
		.from(unit)
		.where(inArray(unit.id, targetIds))
		.orderBy(unit.id);
	const globalLock = globalTargets.find((target) => target.postTargetingLocked);
	if (globalLock)
		return {
			scope: "global",
			relation: relationFor(targets, globalLock.id),
			targetUnitId: globalLock.id,
		};
	if (!input.realmId) return null;
	const realmTargets = await executor
		.select({ unitId: realmUnit.unitId, postTargetingLocked: realmUnit.postTargetingLocked })
		.from(realmUnit)
		.where(
			and(
				eq(realmUnit.realmId, input.realmId),
				inArray(realmUnit.unitId, targetIds),
				eq(realmUnit.publicationState, "active"),
			),
		)
		.orderBy(realmUnit.unitId);
	const realmLock = realmTargets.find((target) => target.postTargetingLocked);
	return realmLock
		? {
				scope: "realm",
				relation: relationFor(targets, realmLock.unitId),
				targetUnitId: realmLock.unitId,
				realmId: input.realmId,
			}
		: null;
}

export async function getPostTargetingLockedUnitIds(
	executor: DatabaseExecutor,
	input: { readonly targetUnitIds: readonly string[]; readonly realmId?: string },
): Promise<ReadonlySet<string>> {
	const targetUnitIds = [...new Set(input.targetUnitIds)].sort();
	if (!targetUnitIds.length) return new Set();
	const globalRows = await executor
		.select({ unitId: unit.id })
		.from(unit)
		.where(and(inArray(unit.id, targetUnitIds), eq(unit.postTargetingLocked, true)));
	const locked = new Set(globalRows.map((row) => row.unitId));
	if (!input.realmId) return locked;
	const realmRows = await executor
		.select({ unitId: realmUnit.unitId })
		.from(realmUnit)
		.where(
			and(
				eq(realmUnit.realmId, input.realmId),
				inArray(realmUnit.unitId, targetUnitIds),
				eq(realmUnit.postTargetingLocked, true),
				eq(realmUnit.publicationState, "active"),
			),
		);
	for (const row of realmRows) locked.add(row.unitId);
	return locked;
}

export function toPostTargetingConstraintError(error: unknown): PostTargetingLocked | undefined {
	const constraint = databaseConstraintName(error);
	if (
		constraint !== "post_targeting_global_unlocked" &&
		constraint !== "post_targeting_realm_unlocked"
	)
		return undefined;
	const visited = new Set<unknown>();
	let current = error;
	while (current && typeof current === "object" && !visited.has(current)) {
		visited.add(current);
		const rawDetail = Reflect.get(current, "detail");
		if (typeof rawDetail === "string") {
			try {
				const detail: unknown = JSON.parse(rawDetail);
				if (
					detail &&
					typeof detail === "object" &&
					(Reflect.get(detail, "scope") === "global" ||
						Reflect.get(detail, "scope") === "realm") &&
					(Reflect.get(detail, "relation") === "subject" ||
						Reflect.get(detail, "relation") === "root" ||
						Reflect.get(detail, "relation") === "parent") &&
					typeof Reflect.get(detail, "targetUnitId") === "string" &&
					(Reflect.get(detail, "scope") === "global" ||
						typeof Reflect.get(detail, "realmId") === "string")
				)
					return new PostTargetingLocked(detail as PostTargetingLockDetails);
			} catch {
				return undefined;
			}
		}
		current = Reflect.get(current, "cause");
	}
	return undefined;
}
