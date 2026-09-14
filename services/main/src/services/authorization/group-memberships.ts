import { createHash } from "node:crypto";
import { and, eq, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import type { DatabaseTransaction } from "../database";
import { accessGroup, accessGroupTree } from "../database/schema/access-group";
import { accessMembership } from "../database/schema/access-membership";
import {
	accessGroupMembership,
	accessGroupMembershipEvent,
	accessGroupMembershipSet,
} from "../database/schema/access-group-membership";
const version = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const schema = z.strictObject({
	scopeId: z.uuid(),
	membershipId: z.uuid(),
	generation: version.min(1),
	groupId: z.uuid(),
	expectedVersion: version,
	operationId: z.uuid(),
	operation: z.enum(["assign", "remove", "prune"]),
	operatorAuthUserId: z.uuid(),
	authoritySubjectId: z.uuid(),
});
/** One direct selection transition under current owner authority, for an exact admission. @internal */
export type AccessGroupMembershipCommand = z.infer<typeof schema>;
/** Historical command result; selectedAfter alone does not establish current Group membership. @internal */
export interface AccessGroupMembershipReceipt {
	membershipId: string;
	generation: number;
	groupId: string;
	version: number;
	operationId: string;
	selectedAfter: boolean;
}
/** The selection or operation precondition conflicts with current state. @internal */
export class AccessGroupMembershipConflict extends Error {
	constructor() {
		super("Group membership command conflicts with current selection or operation receipt");
	}
}
/** Current management and assignment-impact admission denied the transition. @internal */
export class AccessGroupMembershipAdmissionDenied extends Error {
	constructor() {
		super("Current Group membership admission is required");
	}
}
/** A missing fence, eligibility source or unknown admission cannot become an empty or allowed result. @internal */
export class AccessGroupMembershipUnavailable extends Error {
	constructor() {
		super("Group membership state or admission is unavailable");
	}
}
/** Physical selected slots must be pruned or removed before a new selection can fit. @internal */
export class AccessGroupMembershipBudgetExceeded extends Error {
	constructor() {
		super("Direct Group selection budget is exhausted");
	}
}
function requireAdmission(value: boolean | null | undefined) {
	if (value === false) throw new AccessGroupMembershipAdmissionDenied();
	if (value !== true) throw new AccessGroupMembershipUnavailable();
}
function receipt(
	row: typeof accessGroupMembershipEvent.$inferSelect,
): AccessGroupMembershipReceipt {
	return {
		membershipId: row.membershipId,
		generation: row.generation,
		groupId: row.groupId,
		version: row.version,
		operationId: row.operationId,
		selectedAfter: row.selectedAfter,
	};
}
/**
 * Change one direct selection in a savepoint, locking tree, enrollment and admission set in order.
 * @internal
 * @remarks The owner first acquires its complete authority fences, promoting any
 * overlapping set/selection fence. Admission is side-effect-free current SQL,
 * including actor/subject eligibility, management, assignment ceilings and impact.
 * Pruning is explicit and limited to permanently ineffective selections; a full
 * budget does not trigger hidden multi-selection mutation. Each effect advances
 * its set only after final pre-change admission. Receipt reuse rechecks admission.
 */
export async function applyAccessGroupMembershipCommand(
	tx: DatabaseTransaction,
	input: AccessGroupMembershipCommand,
	admission: SQL<boolean | null>,
): Promise<AccessGroupMembershipReceipt> {
	const command = schema.parse(input),
		requestDigest = createHash("sha256").update(JSON.stringify(command)).digest("hex");
	return tx.transaction(async (work) => {
		const authorize = async () =>
			requireAdmission(
				(await work.execute<{ admitted: boolean | null }>(sql`select (${admission}) as admitted`))
					.rows[0]?.admitted,
			);
		await authorize();
		const [tree] = await work
			.select({ id: accessGroupTree.scopeId })
			.from(accessGroupTree)
			.where(eq(accessGroupTree.scopeId, command.scopeId))
			.for("share");
		if (!tree) throw new AccessGroupMembershipUnavailable();
		await authorize();
		const [member] = await work
			.select()
			.from(accessMembership)
			.where(
				and(
					eq(accessMembership.id, command.membershipId),
					eq(accessMembership.scopeId, command.scopeId),
				),
			)
			.for("share");
		if (!member) throw new AccessGroupMembershipConflict();
		await authorize();
		const [set] = await work
			.select()
			.from(accessGroupMembershipSet)
			.where(
				and(
					eq(accessGroupMembershipSet.membershipId, command.membershipId),
					eq(accessGroupMembershipSet.generation, command.generation),
					eq(accessGroupMembershipSet.scopeId, command.scopeId),
				),
			)
			.for("update");
		if (!set) throw new AccessGroupMembershipUnavailable();
		await authorize();
		const [group] = await work
			.select()
			.from(accessGroup)
			.where(and(eq(accessGroup.id, command.groupId), eq(accessGroup.scopeId, command.scopeId)))
			.limit(1);
		if (!group) throw new AccessGroupMembershipConflict();
		const target = and(
			eq(accessGroupMembership.membershipId, command.membershipId),
			eq(accessGroupMembership.generation, command.generation),
			eq(accessGroupMembership.groupId, command.groupId),
		);
		if (command.operation === "assign")
			await work
				.insert(accessGroupMembership)
				.values({
					membershipId: command.membershipId,
					generation: command.generation,
					groupId: command.groupId,
					scopeId: command.scopeId,
				})
				.onConflictDoNothing();
		const [head] = await work.select().from(accessGroupMembership).where(target).for("update");
		if (!head) throw new AccessGroupMembershipConflict();
		await authorize();
		const [prior] = await work
			.select()
			.from(accessGroupMembershipEvent)
			.where(
				and(
					eq(accessGroupMembershipEvent.membershipId, head.membershipId),
					eq(accessGroupMembershipEvent.generation, head.generation),
					eq(accessGroupMembershipEvent.groupId, head.groupId),
					eq(accessGroupMembershipEvent.operationId, command.operationId),
				),
			)
			.limit(1);
		if (prior) {
			if (
				prior.requestDigest !== requestDigest ||
				prior.operatorAuthUserId !== command.operatorAuthUserId ||
				prior.authoritySubjectId !== command.authoritySubjectId
			)
				throw new AccessGroupMembershipConflict();
			return receipt(prior);
		}
		const selectedAfter = command.operation === "assign";
		if (head.version !== command.expectedVersion || head.selected === selectedAfter)
			throw new AccessGroupMembershipConflict();
		if (
			selectedAfter &&
			(member.activeGeneration !== command.generation || group.state !== "active")
		)
			throw new AccessGroupMembershipConflict();
		if (
			command.operation === "prune" &&
			member.activeGeneration === command.generation &&
			group.state !== "retired"
		)
			throw new AccessGroupMembershipConflict();
		if (selectedAfter) {
			const candidates = await work
				.select({ id: accessGroupMembership.groupId })
				.from(accessGroupMembership)
				.where(
					and(
						eq(accessGroupMembership.membershipId, head.membershipId),
						eq(accessGroupMembership.generation, head.generation),
						eq(accessGroupMembership.selected, true),
					),
				)
				.limit(65);
			if (candidates.length >= 64) throw new AccessGroupMembershipBudgetExceeded();
		}
		const [event] = await work
			.insert(accessGroupMembershipEvent)
			.values({
				membershipId: head.membershipId,
				generation: head.generation,
				groupId: head.groupId,
				version: head.version + 1,
				operationId: command.operationId,
				requestDigest,
				operation: command.operation,
				selectedAfter,
				operatorAuthUserId: command.operatorAuthUserId,
				authoritySubjectId: command.authoritySubjectId,
			})
			.returning();
		if (!event) throw Error("Group membership receipt was not written");
		const result = await work.execute<{ admitted: boolean | null; changed: boolean }>(sql`
   with admission as materialized(select (${admission}) as admitted),changed as(
    update public.access_group_membership set version=${event.version},selected=${selectedAfter}
    where membership_id=${head.membershipId}::uuid and generation=${head.generation} and group_id=${head.groupId}::uuid and version=${head.version} and(select admitted from admission) is true returning 1
   ) select(select admitted from admission) as admitted,exists(select 1 from changed) as changed`);
		requireAdmission(result.rows[0]?.admitted);
		if (!result.rows[0]?.changed) throw new AccessGroupMembershipConflict();
		return receipt(event);
	});
}

/** Bounded current direct selections and separate inherited paths; not a disclosure or authorization receipt. @internal */
export interface AccessGroupMembershipSnapshot {
	membershipId: string;
	generation: number | null;
	setVersion: number | null;
	direct: readonly { groupId: string; selectionVersion: number }[];
	paths: readonly { directGroupId: string; groupId: string; groupVersion: number; depth: number }[];
	obsoleteGroupIds: readonly string[];
}
/**
 * Read Groups for a known enrollment, retaining shared tree/enrollment/set fences.
 * @internal
 * @remarks The owner supplies eligibility/restriction/disclosure checks and the
 * broader absent-enrollment/scope-subject negative fence. A path may reach a Group
 * both directly and through another Group; grants must be deduplicated separately.
 * Unknown or truncated sources are unavailable, not a partial allow. At most 64
 * selected roots and 512 path rows are read, without scanning retained history.
 */
export async function readAccessGroupMemberships(
	tx: DatabaseTransaction,
	input: { scopeId: string; membershipId: string },
): Promise<AccessGroupMembershipSnapshot> {
	z.uuid().parse(input.scopeId);
	z.uuid().parse(input.membershipId);
	const [tree] = await tx
		.select({ id: accessGroupTree.scopeId })
		.from(accessGroupTree)
		.where(eq(accessGroupTree.scopeId, input.scopeId))
		.for("share");
	if (!tree) throw new AccessGroupMembershipUnavailable();
	const [member] = await tx
		.select()
		.from(accessMembership)
		.where(
			and(eq(accessMembership.id, input.membershipId), eq(accessMembership.scopeId, input.scopeId)),
		)
		.for("share");
	if (!member) throw new AccessGroupMembershipUnavailable();
	if (member.activeGeneration === null)
		return {
			membershipId: member.id,
			generation: null,
			setVersion: null,
			direct: [],
			paths: [],
			obsoleteGroupIds: [],
		};
	const [set] = await tx
		.select()
		.from(accessGroupMembershipSet)
		.where(
			and(
				eq(accessGroupMembershipSet.membershipId, member.id),
				eq(accessGroupMembershipSet.generation, member.activeGeneration),
			),
		)
		.for("share");
	if (!set) throw new AccessGroupMembershipUnavailable();
	const selected = await tx
		.select({
			groupId: accessGroupMembership.groupId,
			selectionVersion: accessGroupMembership.version,
		})
		.from(accessGroupMembership)
		.where(
			and(
				eq(accessGroupMembership.membershipId, member.id),
				eq(accessGroupMembership.generation, member.activeGeneration),
				eq(accessGroupMembership.selected, true),
			),
		)
		.orderBy(accessGroupMembership.groupId)
		.limit(65);
	if (selected.length > 64) throw new AccessGroupMembershipBudgetExceeded();
	if (selected.length === 0)
		return {
			membershipId: member.id,
			generation: member.activeGeneration,
			setVersion: set.version,
			direct: [],
			paths: [],
			obsoleteGroupIds: [],
		};
	const roots = sql.join(
		selected.map((row) => sql`${row.groupId}::uuid`),
		sql`, `,
	);
	const rows = (
		await tx.execute<{
			direct_id: string;
			id: string;
			parent_id: string | null;
			version: string;
			state: string;
			depth: number;
		}>(sql`
  with recursive paths(direct_id,id,parent_id,version,state,depth) as (
   select id,id,parent_id,version,state,1 from public.access_group where scope_id=${input.scopeId}::uuid and id in(${roots})
   union all select p.direct_id,g.id,g.parent_id,g.version,g.state,p.depth+1 from paths p join public.access_group g on g.id=p.parent_id and g.scope_id=${input.scopeId}::uuid where p.state='active' and p.depth<8
  ) select * from paths order by direct_id,depth limit 513`)
	).rows;
	if (rows.length > 512) throw new AccessGroupMembershipBudgetExceeded();
	const direct: { groupId: string; selectionVersion: number }[] = [],
		obsoleteGroupIds: string[] = [];
	const paths: { directGroupId: string; groupId: string; groupVersion: number; depth: number }[] =
		[];
	const byRoot = new Map<string, typeof rows>();
	for (const row of rows) {
		const path = byRoot.get(row.direct_id) ?? [];
		path.push(row);
		byRoot.set(row.direct_id, path);
	}
	for (const root of selected) {
		const path = byRoot.get(root.groupId),
			first = path?.[0];
		if (!first || first.depth !== 1) throw new AccessGroupMembershipUnavailable();
		if (first.state === "retired") {
			if (path.length !== 1) throw new AccessGroupMembershipUnavailable();
			obsoleteGroupIds.push(root.groupId);
			continue;
		}
		if (first.state !== "active" || path.at(-1)?.parent_id !== null)
			throw new AccessGroupMembershipUnavailable();
		const seen = new Set<string>();
		for (const [index, row] of path.entries()) {
			const groupVersion = Number(row.version);
			if (
				row.state !== "active" ||
				row.depth !== index + 1 ||
				seen.has(row.id) ||
				!Number.isSafeInteger(groupVersion) ||
				groupVersion < 1 ||
				(index > 0 && path[index - 1]!.parent_id !== row.id)
			)
				throw new AccessGroupMembershipUnavailable();
			seen.add(row.id);
			paths.push({ directGroupId: root.groupId, groupId: row.id, groupVersion, depth: row.depth });
		}
		direct.push(root);
	}
	return {
		membershipId: member.id,
		generation: member.activeGeneration,
		setVersion: set.version,
		direct,
		paths,
		obsoleteGroupIds,
	};
}
