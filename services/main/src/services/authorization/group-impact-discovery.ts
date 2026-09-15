import { randomUUID } from "node:crypto";
import { and, eq, gt, gte, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import { AccessPermissionValues } from "@rezics/access";
import type { DatabaseTransaction } from "../database";
import { accessGroup, accessGroupTree } from "../database/schema/access-group";
import { accessGroupImpactReview as reviews, accessGroupImpactNode as nodes, accessGroupImpactFact as facts,
	accessGroupImpactWitness as witnesses, accessImpactFence as fences } from "../database/schema/access-group-impact";
import { AccessChanged, AccessRecordUnavailable, AccessUnavailable } from "./http-errors";
import { decodeAccessPermissionSnapshot, AccessPermissionSnapshotUnavailable } from "./permission";

const id = z.uuid().toLowerCase(), version = z.number().int().safe().nonnegative();
/** Exact topology proposal; completing discovery cannot authorize this transition. @alpha */
export const GroupImpactProposalSchema = z.discriminatedUnion("operation", [
	z.strictObject({ reviewId: id, operation: z.literal("reparent"), expectedGroupVersion: version.min(1), expectedTreeVersion: version, proposedParentId: id.nullable() }),
	z.strictObject({ reviewId: id, operation: z.literal("retire"), expectedGroupVersion: version.min(1), expectedTreeVersion: version, proposedParentId: z.null() }),
]);
/** Private retained proposal and its bounded evidence budget. @internal */
export type GroupImpactReview = typeof reviews.$inferSelect;
type Review = GroupImpactReview;
type Node = typeof nodes.$inferSelect;
type Kind = "roster" | "scope-roster" | "subtree" | "group" | "group-context" | "binding" | "binding-context" | "role" | "ceiling" | "representation" | "representation-context" | "membership";
type Payload = Record<string, unknown>;
const maxNodes = 4096, maxFacts = 32768, maxWork = 65536, maxBytes = 16 * 1024 * 1024;
const scalarId = id.nullable().optional(), scalarVersion = version.nullable().optional();
const headSchema = z.object({ id: scalarId, version: scalarVersion, revision: scalarVersion, state: z.string().optional(), scope_id: scalarId,
	parent_id: scalarId, role_id: scalarId, terms_revision: scalarVersion, active_revision: scalarVersion,
	manager_binding_id: scalarId, parent_grant_id: scalarId, parent_revision: scalarVersion,
	parent_membership_id: scalarId, recipient_group_id: scalarId, parent_selection_group_id: scalarId,
	membership_id: scalarId, selection_group_id: scalarId, active_generation: scalarVersion });
/** Discovery or additional evaluation witness could not be retained completely. @internal */
export class GroupImpactDiscoveryStop extends Error {
	constructor(readonly reason: "budget" | "missing") { super(reason); }
}
function fenceKind(kind: string) {
	if (kind === "roster" || kind === "subtree" || kind === "group-context") return "group";
	if (kind === "representation-context") return "representation";
	if (kind === "binding-context") return "binding";
	return kind;
}
async function now(tx: DatabaseTransaction) {
	const value = (await tx.execute<{ now: string }>(sql`select clock_timestamp()::text as now`)).rows[0]?.now;
	if (!value) throw new AccessUnavailable();
	return new Date(value);
}
/** Retain a positive or negative dependency against the original review snapshot. @internal */
export async function retainGroupImpactWitness(tx: DatabaseTransaction, review: Review, kind: string, key: string) {
	await tx.insert(fences).values({ kind, key }).onConflictDoNothing();
	const [fence] = await tx.select().from(fences).where(and(eq(fences.kind, kind), eq(fences.key, key))).for("share");
	if (!fence) throw new GroupImpactDiscoveryStop("missing");
	const inserted = await tx.insert(witnesses).values({ reviewId: review.id, kind: fence.kind, key: fence.key, version: fence.version }).onConflictDoNothing().returning({ key: witnesses.key });
	if (inserted.length) {
		if (++review.witnessCount > maxNodes * 2 + 1) throw new GroupImpactDiscoveryStop("budget");
	}
}
async function enqueue(tx: DatabaseTransaction, review: Review, kind: Kind, key: string | null | undefined) {
	if (!key) return;
	const [existing] = await tx.select({ key: nodes.key }).from(nodes)
		.where(and(eq(nodes.reviewId, review.id), eq(nodes.kind, kind), eq(nodes.key, key))).limit(1);
	if (existing) return;
	if (review.nodeCount >= maxNodes) throw new GroupImpactDiscoveryStop("budget");
	await tx.insert(nodes).values({ reviewId: review.id, kind, key });
	review.nodeCount++;
}
/** Retain every future source boundary, including one already crossed during discovery. @internal */
export function observeGroupImpactTimes(review: Review, payload: unknown) {
	if (!payload || typeof payload !== "object") return;
	for (const [key, value] of Object.entries(payload)) {
		if (["valid_from", "valid_until", "grant_not_after"].includes(key) && typeof value === "string") {
			const time = new Date(value);
			if (!Number.isFinite(time.getTime())) throw new GroupImpactDiscoveryStop("missing");
			// A boundary crossed since review creation invalidates even a dependency
			// first encountered after that boundary. Never silently recompute its effect.
			if (time > review.createdAt && time < review.validUntil) review.validUntil = time;
		} else if (value && typeof value === "object") observeGroupImpactTimes(review, value);
	}
}
async function saveFact(tx: DatabaseTransaction, review: Review, kind: string, payload: Payload) {
	const bytes = Buffer.byteLength(JSON.stringify(payload), "utf8");
	if (review.factCount >= maxFacts || review.byteCount + bytes > maxBytes) throw new GroupImpactDiscoveryStop("budget");
	observeGroupImpactTimes(review, payload);
	await tx.insert(facts).values({ id: randomUUID(), reviewId: review.id, ordinal: ++review.factCount, kind, payload });
	review.byteCount += bytes;
}

/** Revalidate every positive and negative witness under retained locks, then check the database clock. @internal */
export async function revalidateGroupImpactDiscovery(tx: DatabaseTransaction, review: Review): Promise<void> {
	if (review.status === "invalidated" || review.status === "unavailable") return;
	const isolation = (await tx.execute<{ isolation: string }>(sql`select current_setting('transaction_isolation') as isolation`)).rows[0]?.isolation;
	if (isolation !== "read committed") throw new AccessUnavailable();
	const rows = (await tx.execute<{ kind: string; key: string; version: string; expected: string; visible: boolean }>(sql`
		select f.kind,f.key,f.version::text,w.version::text as expected,
		(f.version=0 or pg_visible_in_snapshot(f.last_writer_xid::xid8,${review.baseSnapshot}::pg_snapshot)) as visible
		from public.access_group_impact_witness w join public.access_impact_fence f on f.kind=w.kind and f.key=w.key
		where w.review_id=${review.id}::uuid order by f.kind,f.key for share of f`)).rows;
	if (rows.length > maxNodes * 2 + 1) throw new GroupImpactDiscoveryStop("budget");
	if (rows.length !== review.witnessCount || !rows.length) { review.status = "unavailable"; review.reason = "missing"; }
	else if (rows.some(row => row.version !== row.expected || row.visible !== true)) { review.status = "invalidated"; review.reason = "changed"; }
	else if (await now(tx) >= review.validUntil) { review.status = "invalidated"; review.reason = "expired"; }
	await persist(tx, review);
}
async function persist(tx: DatabaseTransaction, review: Review) {
	await tx.update(reviews).set({ status: review.status, reason: review.reason, pageVersion: review.pageVersion,
		witnessCount: review.witnessCount, nodeCount: review.nodeCount, factCount: review.factCount, workCount: review.workCount,
		byteCount: review.byteCount, validUntil: review.validUntil }).where(eq(reviews.id, review.id));
}

/** Acquire a private review. The management adapter must check current authority before and after this work. @internal */
export async function lockGroupImpactReview(tx: DatabaseTransaction, input: {
	reviewId: string; scopeId: string; groupId: string; principalId: string; subjectId: string;
}) {
	const [review] = await tx.select().from(reviews).where(and(eq(reviews.id, input.reviewId), eq(reviews.scopeId, input.scopeId),
		eq(reviews.groupId, input.groupId), eq(reviews.operatorAuthUserId, input.principalId), eq(reviews.authoritySubjectId, input.subjectId))).for("update");
	if (!review) throw new AccessRecordUnavailable();
	return review;
}

/** Start a retryable proposal at exact Group/tree versions; ancestor traversal is bounded to eight. @internal */
export async function beginGroupImpactDiscovery(tx: DatabaseTransaction, input: z.infer<typeof GroupImpactProposalSchema> & {
	scopeId: string; groupId: string; principalId: string; subjectId: string;
	reviewerSources: { bindingId: string | null; representationIds: string[]; validUntil: number | null };
}): Promise<Review> {
	const proposal = GroupImpactProposalSchema.parse({ reviewId: input.reviewId, operation: input.operation,
		expectedGroupVersion: input.expectedGroupVersion, expectedTreeVersion: input.expectedTreeVersion, proposedParentId: input.proposedParentId });
	// Serializes only this reviewer's intake; unrelated principals have independent budgets.
	await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${'group-impact:'+input.principalId},0))`);
	const [prior] = await tx.select().from(reviews).where(eq(reviews.id, input.reviewId)).for("update");
	if (prior) {
		if (prior.scopeId !== input.scopeId || prior.groupId !== input.groupId || prior.operatorAuthUserId !== input.principalId || prior.authoritySubjectId !== input.subjectId)
			throw new AccessRecordUnavailable();
		if (prior.operation !== proposal.operation || prior.proposedParentId !== proposal.proposedParentId ||
			prior.expectedGroupVersion !== proposal.expectedGroupVersion || prior.expectedTreeVersion !== proposal.expectedTreeVersion) throw new AccessChanged();
		await revalidateGroupImpactDiscovery(tx, prior); return prior;
	}
	const isolation = (await tx.execute<{ isolation: string }>(sql`select current_setting('transaction_isolation') as isolation`)).rows[0]?.isolation;
	if (isolation !== "read committed") throw new AccessUnavailable();
	const [tree] = await tx.select().from(accessGroupTree).where(eq(accessGroupTree.scopeId, input.scopeId)).for("share");
	const [head] = await tx.select().from(accessGroup).where(and(eq(accessGroup.id, input.groupId), eq(accessGroup.scopeId, input.scopeId)));
	if (!head || !tree) throw new AccessRecordUnavailable();
	if (tree.version !== proposal.expectedTreeVersion || head.version !== proposal.expectedGroupVersion || head.state !== "active" ||
		(proposal.operation === "retire" && head.subtreeHeight !== 1) || (proposal.operation === "reparent" && proposal.proposedParentId === head.parentId)) throw new AccessChanged();
	const [start] = (await tx.execute<{ now: string; snapshot: string }>(sql`select clock_timestamp()::text as now,pg_current_snapshot()::text as snapshot`)).rows;
	if (!start || Buffer.byteLength(start.snapshot,"utf8") > 65536) throw new AccessUnavailable();
	const started = new Date(start.now), expiresAt = new Date(started.getTime() + 900_000);
	const retained = await tx.select({ id: reviews.id }).from(reviews).where(and(eq(reviews.operatorAuthUserId, input.principalId),
		gt(reviews.expiresAt, new Date(started.getTime() - 86_400_000)))).orderBy(reviews.expiresAt, reviews.id).limit(16);
	if (retained.length >= 16) throw new AccessUnavailable();
	const [review] = await tx.insert(reviews).values({ id: proposal.reviewId, scopeId: input.scopeId, groupId: input.groupId,
		operatorAuthUserId: input.principalId, authoritySubjectId: input.subjectId, operation: proposal.operation,
		proposedParentId: proposal.proposedParentId, expectedGroupVersion: proposal.expectedGroupVersion,
		expectedTreeVersion: proposal.expectedTreeVersion, baseSnapshot: start.snapshot, createdAt: started, expiresAt, validUntil: input.reviewerSources.validUntil === null ? expiresAt : new Date(Math.min(expiresAt.getTime(), input.reviewerSources.validUntil)) }).onConflictDoNothing().returning();
	if (!review) return beginGroupImpactDiscovery(tx, input);
	await retainGroupImpactWitness(tx, review, "tree", input.scopeId);
	await retainGroupImpactWitness(tx, review, "group", input.groupId);
	await enqueue(tx, review, "subtree", head.id);
	await enqueue(tx, review, "binding-context", input.reviewerSources.bindingId);
	for (const grantId of input.reviewerSources.representationIds) await enqueue(tx, review, "representation-context", grantId);
	for (const [kind, root] of [["old-ancestor", head.parentId], ["new-ancestor", proposal.proposedParentId]] as const) {
		let key = root, depth = 0;
		while (key !== null) {
			if (++depth > 8 || key === head.id) throw new AccessChanged();
			const [ancestor] = await tx.select().from(accessGroup).where(and(eq(accessGroup.id, key), eq(accessGroup.scopeId, input.scopeId)));
			if (!ancestor || ancestor.state !== "active") throw new AccessChanged();
			await retainGroupImpactWitness(tx, review, "group", key);
			await saveFact(tx, review, kind, { id: ancestor.id, version: ancestor.version, parentId: ancestor.parentId });
			await enqueue(tx, review, "group", key);
			key = ancestor.parentId;
		}
		if (kind === "new-ancestor" && depth + head.subtreeHeight > 8) throw new AccessChanged();
	}
	await revalidateGroupImpactDiscovery(tx, review);
	return review;
}

async function point(tx: DatabaseTransaction, table: string, keyColumn: string, key: string): Promise<Payload> {
	const row = (await tx.execute<{ payload: Payload }>(sql`select to_jsonb(t) as payload from ${sql.identifier("public")}.${sql.identifier(table)} t where ${sql.identifier(keyColumn)}=${key}::uuid`)).rows[0];
	if (!row) throw new GroupImpactDiscoveryStop("missing");
	return row.payload;
}
async function terms(tx: DatabaseTransaction, table: string, column: string, key: string, revision: number) {
	const row = (await tx.execute<{ payload: Payload }>(sql`select to_jsonb(t) as payload from ${sql.identifier("public")}.${sql.identifier(table)} t
		where ${sql.identifier(column)}=${key}::uuid and revision=${revision}`)).rows[0];
	if (!row || row.payload.sealed !== true) throw new GroupImpactDiscoveryStop("missing");
	return row.payload;
}
async function permissions(tx: DatabaseTransaction, table: string, column: string, key: string, revision: number | null, snapshot: Payload) {
	const rows = (await tx.execute<{ family: string; permission: string }>(sql`select family,permission from ${sql.identifier("public")}.${sql.identifier(table)}
		where ${sql.identifier(column)}=${key}::uuid ${revision === null ? sql`` : sql`and revision=${revision}`}
		order by family,permission limit ${AccessPermissionValues.length + 1}`)).rows;
	if (rows.length > AccessPermissionValues.length) throw new GroupImpactDiscoveryStop("budget");
	const metadata = z.object({ permission_count: version, permission_digest: z.string() }).parse(snapshot);
	// This owner already validates cardinality, known vocabulary and exact digest.
	decodeAccessPermissionSnapshot(rows, metadata.permission_count, metadata.permission_digest);
	return rows;
}
async function captureEligibility(tx: DatabaseTransaction, review: Review, input: unknown) {
	const basis = z.object({ membership_id: scalarId, membership_generation: scalarVersion,
		selection_group_id: scalarId, selection_version: scalarVersion }).parse(input);
	if (!basis.membership_id) return null;
	if (!basis.membership_generation) throw new GroupImpactDiscoveryStop("missing");
	await retainGroupImpactWitness(tx, review, "membership", basis.membership_id);
	await enqueue(tx, review, "membership", basis.membership_id);
	const [admission] = (await tx.execute<{ payload: Payload }>(sql`select to_jsonb(a) as payload from public.access_membership_admission a
		where a.membership_id=${basis.membership_id}::uuid and a.generation=${basis.membership_generation}`)).rows;
	if (!admission) throw new GroupImpactDiscoveryStop("missing");
	let selection: Payload | null = null;
	if (basis.selection_group_id) {
		await retainGroupImpactWitness(tx, review, "group", basis.selection_group_id);
		await enqueue(tx, review, "group-context", basis.selection_group_id);
		const [row] = (await tx.execute<{ payload: Payload }>(sql`select to_jsonb(s) as payload from public.access_group_membership s
			where s.membership_id=${basis.membership_id}::uuid and s.generation=${basis.membership_generation}
			and s.group_id=${basis.selection_group_id}::uuid`)).rows;
		if (!row) throw new GroupImpactDiscoveryStop("missing");
		selection = row.payload;
	}
	return { admission: admission.payload, selection, expectedSelectionVersion: basis.selection_version ?? null };
}
async function capture(tx: DatabaseTransaction, review: Review, node: Node) {
	if (node.kind === "scope-roster") {
		await retainGroupImpactWitness(tx, review, "tree", node.key);
		await saveFact(tx, review, node.kind, { id: node.key });
		await tx.update(nodes).set({ payload: { captured: true } }).where(and(eq(nodes.reviewId, review.id), eq(nodes.kind, node.kind), eq(nodes.key, node.key)));
		return;
	}
	await retainGroupImpactWitness(tx, review, fenceKind(node.kind), node.key);
	const kind = fenceKind(node.kind);
	const table = kind === "binding" ? "access_role_binding" : kind === "ceiling" ? "access_assignment_ceiling" : `access_${kind}`;
	const payload = await point(tx, table, "id", node.key);
	const head = headSchema.parse(payload);
	if (kind === "group") {
		if (!head.scope_id) throw new GroupImpactDiscoveryStop("missing");
		await retainGroupImpactWitness(tx, review, "tree", head.scope_id);
		await enqueue(tx, review, "group-context", head.parent_id);
	} else if (kind === "binding" || kind === "representation" || kind === "role") {
		const revision = kind === "role" ? head.active_revision : head.terms_revision;
		if (revision !== null && revision !== undefined) {
			const column = kind === "role" ? "role_id" : kind === "binding" ? "binding_id" : "grant_id";
			const selected = await terms(tx, `${table}_revision`, column, node.key, revision);
			payload.terms = selected;
			payload.eligibility = await captureEligibility(tx, review, selected);
			payload.permissions = await permissions(tx, `${table}_permission`, column, node.key, revision, selected);
			const basis = headSchema.parse(selected);
			await enqueue(tx, review, "membership", basis.membership_id);
			await enqueue(tx, review, "group-context", basis.selection_group_id);
		}
		if (kind === "binding") await enqueue(tx, review, "role", head.role_id);
		if (kind === "representation") {
			// A dependent edge can lose/reacquire liveness for recipients outside the moved subtree.
			// Roster work expands only recipients, never their unrelated assignment graph.
			if (node.kind === "representation") {
				if (payload.recipient_kind === "group") await enqueue(tx, review, "roster", head.recipient_group_id);
				if (payload.recipient_kind === "all-members") await enqueue(tx, review, "scope-roster", id.parse(payload.recipient_scope_id));
			}
			await enqueue(tx, review, "representation-context", head.parent_grant_id);
			await enqueue(tx, review, "membership", head.parent_membership_id);
			await enqueue(tx, review, "group-context", head.parent_selection_group_id);
			// Retain the exact immutable parent selection as well as its current head.
			if (head.parent_grant_id && head.parent_revision) {
				await retainGroupImpactWitness(tx, review, "representation", head.parent_grant_id);
				const parentTerms = await terms(tx, "access_representation_revision", "grant_id", head.parent_grant_id, head.parent_revision);
				payload.parentTerms = parentTerms;
				payload.parentPermissions = await permissions(tx, "access_representation_permission", "grant_id", head.parent_grant_id, head.parent_revision, parentTerms);
				payload.parentTermsEligibility = await captureEligibility(tx, review, parentTerms);
				payload.parentBasis = await captureEligibility(tx, review, { membership_id: payload.parent_membership_id,
					membership_generation: payload.parent_membership_generation, selection_group_id: payload.parent_selection_group_id,
					selection_version: payload.parent_selection_version });
			}
		}
		await enqueue(tx, review, "group-context", head.recipient_group_id);
	} else if (kind === "ceiling") {
		if (payload.sealed !== true) throw new GroupImpactDiscoveryStop("missing");
		payload.permissions = await permissions(tx, "access_assignment_ceiling_permission", "ceiling_id", node.key, null, payload);
		await enqueue(tx, review, "role", head.role_id);
		await enqueue(tx, review, "binding-context", head.manager_binding_id);
		if (!head.manager_binding_id) throw new GroupImpactDiscoveryStop("missing");
		await retainGroupImpactWitness(tx, review, "binding", head.manager_binding_id);
		const managerRevision = version.min(1).parse(payload.manager_terms_revision);
		const managerTerms = await terms(tx, "access_role_binding_revision", "binding_id", head.manager_binding_id, managerRevision);
		payload.managerTerms = managerTerms;
		payload.managerPermissions = await permissions(tx, "access_role_binding_permission", "binding_id", head.manager_binding_id, managerRevision, managerTerms);
		payload.managerEligibility = await captureEligibility(tx, review, payload.managerTerms);
		await enqueue(tx, review, "group-context", head.recipient_group_id);
	} else if (kind === "membership" && head.active_generation) {
		const selections = (await tx.execute<{ payload: Payload }>(sql`select to_jsonb(s) as payload from public.access_group_membership s
			where s.membership_id=${node.key}::uuid and s.generation=${head.active_generation} and s.selected order by s.group_id limit 65`)).rows;
		if (selections.length > 64) throw new GroupImpactDiscoveryStop("budget");
		payload.selections = selections.map(row => row.payload);
		const set = (await tx.execute<{ payload: Payload }>(sql`select to_jsonb(s) as payload from public.access_group_membership_set s
			where s.membership_id=${node.key}::uuid and s.generation=${head.active_generation}`)).rows[0];
		if (!set) throw new GroupImpactDiscoveryStop("missing");
		payload.selectionSet = set.payload;
		const admission = (await tx.execute<{ payload: Payload }>(sql`select to_jsonb(a) as payload from public.access_membership_admission a
			where a.membership_id=${node.key}::uuid and a.generation=${head.active_generation}`)).rows[0];
		if (!admission) throw new GroupImpactDiscoveryStop("missing");
		payload.admission = admission.payload;
		for (const selection of selections) await enqueue(tx, review, "group-context", id.parse(selection.payload.group_id));
	}
	await saveFact(tx, review, node.kind, payload);
	// Payload exists only once in the fact store; the node is a completion marker.
	await tx.update(nodes).set({ payload: { captured: true } }).where(and(eq(nodes.reviewId, review.id), eq(nodes.kind, node.kind), eq(nodes.key, node.key)));
}

type Stream = { table: string; column: string; keys: string[]; next: Kind; nextColumn: string; fact: string; extra?: SQL };
function streams(node: Node, scopeId: string): Stream[] {
	if (node.kind === "scope-roster") return [{ table: "access_membership", column: "scope_id", keys: ["subject_id"], next: "membership", nextColumn: "id", fact: "roster-membership" }];
	if (node.kind === "roster") return [
		{ table: "access_group", column: "parent_id", keys: ["id"], next: "roster", nextColumn: "id", fact: "roster-child", extra: sql`scope_id=(select scope_id from public.access_group where id=${node.key}::uuid) and state='active'` },
		{ table: "access_group_membership", column: "group_id", keys: ["membership_id", "generation"], next: "membership", nextColumn: "membership_id", fact: "direct-selection", extra: sql`selected` },
	];
	if (node.kind === "group" || node.kind === "subtree") return [
		...(node.kind === "subtree" ? [
			{ table: "access_group", column: "parent_id", keys: ["id"], next: "subtree" as const, nextColumn: "id", fact: "child", extra: sql`scope_id=${scopeId}::uuid and state='active'` },
			{ table: "access_group_membership", column: "group_id", keys: ["membership_id", "generation"], next: "membership" as const, nextColumn: "membership_id", fact: "direct-selection", extra: sql`selected` },
		] : []),
		{ table: "access_role_binding", column: "recipient_group_id", keys: ["id"], next: "binding", nextColumn: "id", fact: "group-binding" },
		{ table: "access_assignment_ceiling", column: "recipient_group_id", keys: ["id"], next: "ceiling", nextColumn: "id", fact: "group-ceiling" },
		{ table: "access_representation", column: "recipient_group_id", keys: ["id"], next: "representation", nextColumn: "id", fact: "group-representation" },
		{ table: "access_role_binding_revision", column: "selection_group_id", keys: ["binding_id", "revision"], next: "binding", nextColumn: "binding_id", fact: "binding-selection" },
		{ table: "access_representation_revision", column: "selection_group_id", keys: ["grant_id", "revision"], next: "representation", nextColumn: "grant_id", fact: "representation-selection" },
		{ table: "access_representation", column: "parent_selection_group_id", keys: ["id"], next: "representation", nextColumn: "id", fact: "representation-parent-selection" },
	];
	if (node.kind === "binding") return [{ table: "access_assignment_ceiling", column: "manager_binding_id", keys: ["id"], next: "ceiling", nextColumn: "id", fact: "manager-ceiling" }];
	if (node.kind === "representation") return [{ table: "access_representation", column: "parent_grant_id", keys: ["id"], next: "representation", nextColumn: "id", fact: "dependent-representation" }];
	return [];
}
async function scan(tx: DatabaseTransaction, review: Review, node: Node, source: Stream) {
	const keyColumns = source.keys.map(key => sql.identifier(key));
	const cursor = node.cursor === null ? null : source.keys.map((key, index) => {
		const value = key === "generation" || key === "revision" ? version.parse(node.cursor?.[index]) : id.parse(node.cursor?.[index]);
		return sql`${value}${key === "generation" || key === "revision" ? sql`::bigint` : sql`::uuid`}`;
	});
	const result = (await tx.execute<{ payload: Payload }>(sql`select to_jsonb(t) as payload from ${sql.identifier("public")}.${sql.identifier(source.table)} t
		where ${sql.identifier(source.column)}=${node.key}::uuid ${source.extra ? sql`and (${source.extra})` : sql``}
		${cursor ? sql`and row(${sql.join(keyColumns, sql`,`)})>row(${sql.join(cursor, sql`,`)})` : sql``}
		order by ${sql.join(keyColumns, sql`,`)} limit 101`)).rows;
	for (const { payload } of result.slice(0, 100)) {
		if (source.fact === "direct-selection") payload.eligibility = await captureEligibility(tx, review, {
			membership_id: payload.membership_id, membership_generation: payload.generation,
			selection_group_id: payload.group_id, selection_version: payload.version });
		await saveFact(tx, review, source.fact, payload);
		await enqueue(tx, review, source.next, id.parse(payload[source.nextColumn]));
	}
	const hasMore = result.length > 100;
	await tx.update(nodes).set({ stage: hasMore ? node.stage : node.stage + 1,
		cursor: hasMore ? source.keys.map(key => result[99]!.payload[key]) : null })
		.where(and(eq(nodes.reviewId, review.id), eq(nodes.kind, node.kind), eq(nodes.key, node.key)));
	return result.length;
}

/** Advance server-owned keysets. A retry with the prior page version returns current state without repeating work. @internal */
export async function advanceGroupImpactDiscovery(tx: DatabaseTransaction, review: Review, expectedPageVersion: number) {
	await revalidateGroupImpactDiscovery(tx, review);
	if (expectedPageVersion > review.pageVersion) throw new AccessChanged();
	if (expectedPageVersion < review.pageVersion || review.status !== "discovering") return;
	try {
		// A page is atomic. Budget exhaustion rolls back its partial facts and retains
		// the earlier pages only as explicitly incomplete evidence.
		const next = { ...review };
		await tx.transaction(async page => {
			let candidates = 0;
			for (let steps = 0; steps < 8 && candidates < 400; steps++) {
				if (next.workCount >= maxWork) throw new GroupImpactDiscoveryStop("budget");
				const [node] = await page.select().from(nodes).where(and(eq(nodes.reviewId, next.id), gte(nodes.stage, 0)))
					.orderBy(nodes.kind, nodes.key).limit(1);
				if (!node) { next.status = "complete"; break; }
				next.workCount++;
				if (node.payload === null) { await capture(page, next, node); candidates++; }
				else await retainGroupImpactWitness(page, next, node.kind === "scope-roster" ? "tree" : fenceKind(node.kind), node.key);
				const source = streams(node, next.scopeId)[node.stage];
				if (source) candidates += await scan(page, next, node, source);
				else await page.update(nodes).set({ stage: -1 }).where(and(eq(nodes.reviewId, next.id), eq(nodes.kind, node.kind), eq(nodes.key, node.key)));
			}
			next.pageVersion++;
			await revalidateGroupImpactDiscovery(page, next);
		});
		Object.assign(review, next);
	} catch (error) {
		if (!(error instanceof GroupImpactDiscoveryStop) && !(error instanceof AccessPermissionSnapshotUnavailable)) throw error;
		review.status = "unavailable"; review.reason = error instanceof GroupImpactDiscoveryStop ? error.reason : "missing";
		await persist(tx, review);
	}
}

/** Opaque review-local facts preserve pagination and versions without disclosing private identities or target scopes. @internal */
export async function inspectGroupImpactDiscovery(tx: DatabaseTransaction, review: Review, afterOrdinal = 0) {
	await revalidateGroupImpactDiscovery(tx, review);
	const rows = await tx.select().from(facts).where(and(eq(facts.reviewId, review.id), gt(facts.ordinal, afterOrdinal))).orderBy(facts.ordinal).limit(101);
	const items = rows.slice(0,100).map(row => {
		const head = headSchema.parse(row.payload);
		return { itemId: row.id, ordinal: row.ordinal, kind: row.kind, version: head.version ?? head.revision ?? null,
			termsRevision: head.terms_revision ?? head.active_revision ?? head.revision ?? null, state: head.state ?? null };
	});
	await revalidateGroupImpactDiscovery(tx, review);
	return { ...groupImpactSummary(review), items, nextCursor: rows.length > 100 ? items.at(-1)?.ordinal ?? null : null };
}
/** Coarse discovery progress is explicitly independent of mutation admission. @internal */
export function groupImpactSummary(review: Review) {
	return { reviewId: review.id, operation: review.operation, expectedGroupVersion: review.expectedGroupVersion,
		expectedTreeVersion: review.expectedTreeVersion, proposedParentId: review.proposedParentId,
		status: review.status, reason: review.reason, pageVersion: review.pageVersion, discoveredItems: review.factCount,
		validUntil: review.validUntil.toISOString(), admission: "not-evaluated" as const };
}

/**
 * Exact prerequisite for the subsequent ceiling/recovery admission owner.
 * @internal
 * @remarks Call only after acquiring live actor/target/Entity/tree/enrollment/role
 * authority fences in the mutation transaction. All discovery witnesses remain
 * shared through commit. Page the private fact store in this same transaction;
 * historical facts must not be treated as current eligibility or confer approval.
 * The caller must independently prove complete proposed permission/recipient
 * deltas, explicit ceilings and protected recovery, then recheck their clocks in
 * the final mutation. This function never returns an admission SQL predicate.
 */
export async function lockCompleteGroupImpactDiscovery(tx: DatabaseTransaction, input: {
	reviewId: string; scopeId: string; groupId: string; principalId: string; subjectId: string;
	operation: "reparent" | "retire"; expectedGroupVersion: number; expectedTreeVersion: number; proposedParentId: string | null;
}) {
	const review = await lockGroupImpactReview(tx, input);
	await revalidateGroupImpactDiscovery(tx, review);
	if (review.status !== "complete" || review.operation !== input.operation || review.expectedGroupVersion !== input.expectedGroupVersion ||
		review.expectedTreeVersion !== input.expectedTreeVersion || review.proposedParentId !== input.proposedParentId) throw new AccessUnavailable();
	const [integrity] = (await tx.execute<{ fact_count: number; node_count: number; pending: boolean }>(sql`
		select (select count(*)::integer from public.access_group_impact_fact where review_id=${review.id}::uuid) as fact_count,
		(select count(*)::integer from public.access_group_impact_node where review_id=${review.id}::uuid) as node_count,
		exists(select 1 from public.access_group_impact_node where review_id=${review.id}::uuid and (stage>=0 or payload is null)) as pending`)).rows;
	if (!integrity || integrity.fact_count !== review.factCount || integrity.node_count !== review.nodeCount || integrity.pending) throw new AccessUnavailable();
	if (await now(tx) >= review.validUntil) throw new AccessUnavailable();
	return { reviewId: review.id, factCount: review.factCount, validUntil: review.validUntil, admission: "not-evaluated" as const };
}

/** Read retained private discovery facts after the caller locks the complete review in the same transaction. @internal */
export async function readGroupImpactFacts(tx: DatabaseTransaction, reviewId: string, afterOrdinal = 0) {
	return tx.select({ ordinal: facts.ordinal, kind: facts.kind, payload: facts.payload }).from(facts)
		.where(and(eq(facts.reviewId, reviewId), gt(facts.ordinal, afterOrdinal))).orderBy(facts.ordinal).limit(100);
}
