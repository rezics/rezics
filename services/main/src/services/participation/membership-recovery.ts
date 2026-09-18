import { createHash } from "node:crypto";
import { and, eq, gt, inArray, isNull, sql } from "drizzle-orm";
import type { DatabaseTransaction } from "../database";
import {
	accessRecoveryPath,
	accessRecoveryPolicy,
} from "@rezics/schema/postgres/access/access-group-admission";
import { accessRoleBindingScope } from "@rezics/schema/postgres/access/access-role-binding";
import { accessMembership } from "@rezics/schema/postgres/access/access-membership";
import { AccessDenied, AccessUnavailable } from "../authorization/http-errors";
import { groupAuthoritySourceDigest } from "../authorization/group-impact-evaluation";
import {
	readNativeRecoveryAuthorities,
	recoveryPathContext,
} from "../authorization/group-admission";
import { requireAccessAdmission, rethrowAccessFailure } from "../authorization/transaction";
const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
/**
 * Preserve a currently exercisable native repair route for every directly affected root.
 * @internal
 * @remarks Membership does not copy or assign Groups. Indexed physical source candidates
 * precede deduplication and authority hydration; overflow is unavailable. Pre/post native
 * authority must retain the same exact sources. The owner's Org root needs a recovery
 * route once it has any membership-dependent authority, including dormant sources.
 */
export async function prepareEnrollmentRecovery(
	tx: DatabaseTransaction,
	scopeId: string,
	subjectId: string,
) {
	const [member] = await tx
		.select()
		.from(accessMembership)
		.where(and(eq(accessMembership.scopeId, scopeId), eq(accessMembership.subjectId, subjectId)))
		.for("share");
	const roots = new Set<string>(),
		candidates: { scope_id: string | null; entity_id: string | null }[] = [];
	// Each branch is a bounded index range before joins, DISTINCT or lifecycle filters.
	const sources = [
		sql`select target_scope_id as scope_id,null::uuid as entity_id from public.access_role_binding where recipient_scope_id=${scopeId}::uuid order by id limit 257`,
		sql`select target_scope_id as scope_id,entity_id from public.access_representation where recipient_scope_id=${scopeId}::uuid order by id limit 257`,
		sql`select scope_id,null::uuid as entity_id from public.access_assignment_ceiling where recipient_scope_id=${scopeId}::uuid order by id limit 257`,
	];
	for (const query of sources) {
		const rows = (await tx.execute<{ scope_id: string | null; entity_id: string | null }>(query))
			.rows;
		candidates.push(...rows);
		if (candidates.length > 256) throw new AccessUnavailable();
	}
	if (member) {
		for (const query of [
			sql`with candidates as materialized(select binding_id,revision from public.access_role_binding_revision where membership_id=${member.id}::uuid order by membership_generation,binding_id,revision limit 257)
    select b.target_scope_id as scope_id,null::uuid as entity_id from candidates c join public.access_role_binding b on b.id=c.binding_id`,
			sql`with candidates as materialized(select grant_id,revision from public.access_representation_revision where membership_id=${member.id}::uuid order by membership_generation,grant_id,revision limit 257)
    select r.target_scope_id as scope_id,r.entity_id from candidates c join public.access_representation r on r.id=c.grant_id`,
			sql`select target_scope_id as scope_id,entity_id from public.access_representation where parent_membership_id=${member.id}::uuid order by parent_membership_generation,id limit 257`,
		]) {
			candidates.push(
				...(await tx.execute<{ scope_id: string | null; entity_id: string | null }>(query)).rows,
			);
			if (candidates.length > 256) throw new AccessUnavailable();
		}
	}
	if (!candidates.length) return async (_work: DatabaseTransaction) => {};
	roots.add(scopeId);
	for (const candidate of candidates) {
		if (candidate.scope_id) roots.add(candidate.scope_id);
		// The represented Entity root owns revocation even for all-scope grants;
		// preserve repair there without enumerating its resource corpus.
		if (candidate.entity_id) {
			const [root] = (
				await tx.execute<{ id: string }>(
					sql`select s.id from public.reference_value r join public.access_scope s on s.unit_ref=r.id where r.target_entity_id=${candidate.entity_id}::uuid`,
				)
			).rows;
			if (!root) throw new AccessUnavailable();
			roots.add(root.id);
		}
	}
	if (roots.size > 64) throw new AccessUnavailable();
	const ordered = [...roots].sort();
	const fences = await tx
		.select()
		.from(accessRoleBindingScope)
		.where(inArray(accessRoleBindingScope.scopeId, ordered))
		.orderBy(accessRoleBindingScope.scopeId)
		.for("update");
	if (fences.length !== ordered.length) throw new AccessUnavailable();
	const selected: { row: typeof accessRecoveryPath.$inferSelect; digest: string }[] = [];
	for (const root of ordered) {
		const [policy] = await tx
			.select()
			.from(accessRecoveryPolicy)
			.where(eq(accessRecoveryPolicy.scopeId, root))
			.for("share");
		if (!policy) throw new AccessUnavailable();
		const now = new Date(
			(await tx.execute<{ now: string }>(sql`select clock_timestamp()::text as now`)).rows[0]!.now,
		);
		const paths = await tx
			.select()
			.from(accessRecoveryPath)
			.where(
				and(
					eq(accessRecoveryPath.scopeId, root),
					isNull(accessRecoveryPath.revokedAt),
					gt(accessRecoveryPath.validUntil, now),
				),
			)
			.limit(9)
			.for("share");
		if (paths.length > 8) throw new AccessUnavailable();
		let found = false,
			unavailable = false;
		for (const row of paths) {
			try {
				const authorities = await readNativeRecoveryAuthorities(tx, recoveryPathContext(row), root);
				const digest = hash(authorities.map(groupAuthoritySourceDigest));
				if (digest !== row.sourceDigest || authorities[0]?.subjectId !== row.subjectId) continue;
				for (const authority of authorities) await requireAccessAdmission(tx, authority.admission);
				selected.push({ row, digest });
				found = true;
				break;
			} catch (error) {
				try {
					rethrowAccessFailure(error);
				} catch (failure) {
					if (failure instanceof AccessUnavailable) unavailable = true;
					else if (!(failure instanceof AccessDenied)) throw failure;
				}
			}
		}
		if (!found) {
			if (unavailable) throw new AccessUnavailable();
			throw new AccessDenied();
		}
	}
	return async (work: DatabaseTransaction) => {
		const final = [];
		for (const { row, digest } of selected) {
			const authorities = await readNativeRecoveryAuthorities(
				work,
				recoveryPathContext(row),
				row.scopeId,
			);
			if (hash(authorities.map(groupAuthoritySourceDigest)) !== digest) throw new AccessDenied();
			final.push(
				sql`clock_timestamp()<${row.validUntil}::timestamptz`,
				...authorities.map((authority) => authority.admission),
			);
		}
		await requireAccessAdmission(
			work,
			sql`${sql.join(
				final.map((part) => sql`(${part})`),
				sql` and `,
			)}`,
		);
	};
}
