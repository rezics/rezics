import { and, eq, sql, type SQLWrapper } from "drizzle-orm";
import type { DatabaseTransaction, DatabaseExecutor } from "../database";
import { accessSubject } from "@rezics/schema/postgres/access/access-identity";
import { accessMembership } from "@rezics/schema/postgres/access/access-membership";
import { unitAccessGrant, unitAccessRestriction } from "@rezics/schema/postgres/access/access";
import { allocateAccessScope, allocateAccessSubject } from "../authorization/identities";
import { allocateReferenceValue } from "../units/reference-value";
import { lockUnitAccessState } from "../authorization/unit/access-lock";
import { AccessUnavailable } from "../authorization/http-errors";
/** Explicit public Entity restriction lookup is independent from enrollment/follow history. @internal */
export function realmEntityContributionCondition(realmId: SQLWrapper | string, entityId: string) {
	return sql<boolean>`not exists(select 1 from public.access_subject s join public.realm_enforcement e on e.subject_id=s.id join public.access_scope sc on sc.id=e.scope_id join public.reference_value r on r.id=sc.unit_ref where s.entity_id=${entityId}::uuid and r.target_realm_id=${realmId} and e.state in ('muted','banned'))`;
}
/** Stabilize the current exact Entity enrollment while an existing domain command consumes it. @internal */
export async function lockRealmEntityEnrollment(
	tx: DatabaseTransaction,
	realmId: string,
	entityId: string,
) {
	const subjectId = await allocateAccessSubject(tx, { kind: "entity", id: entityId });
	const scopeId = await allocateAccessScope(tx, {
		kind: "resource",
		referenceValueId: await allocateReferenceValue(tx, { owner: "realm", id: realmId }),
	});
	await tx.execute(
		sql`select public.lock_access_membership_key(${scopeId}::uuid,${subjectId}::uuid,false)`,
	);
}
/** Bound literal Realm userset dependencies before evaluating retained Unit grant consumers. @internal */
export async function lockRealmGrantMemberships(
	tx: DatabaseTransaction,
	unitId: string,
	entityId: string,
) {
	const scopes = new Set<string>(),
		pending = [unitId];
	let examined = 0;
	// The access-manager userset permits one nonrecursive manager-root lookup.
	for (let depth = 0; depth < 2; depth++) {
		const roots = [...pending];
		pending.length = 0;
		for (const targetId of roots.sort()) {
			await lockUnitAccessState(tx, [targetId], "shared");
			for (const table of [unitAccessGrant, unitAccessRestriction]) {
				const rows = await tx
					.select({ realmId: table.realmId, relation: table.realmRelation })
					.from(table)
					.where(eq(table.unitId, targetId))
					.orderBy(table.id)
					.limit(257 - examined);
				examined += rows.length;
				if (examined > 256) throw new AccessUnavailable();
				for (const row of rows)
					if (row.realmId) {
						scopes.add(row.realmId);
						if (scopes.size > 64) throw new AccessUnavailable();
						if (depth === 0 && row.relation === "access_manager") pending.push(row.realmId);
					}
			}
		}
	}
	for (const realmId of [...scopes].sort()) await lockRealmEntityEnrollment(tx, realmId, entityId);
}

/** Account-facing discovery bounds physical shared admissions before Realm/type/enforcement filtering. @internal */
export async function publicRealmMembershipCandidates(
	executor: DatabaseExecutor,
	entityId: string,
) {
	const [subject] = await executor
		.select({ id: accessSubject.id })
		.from(accessSubject)
		.where(eq(accessSubject.entityId, entityId));
	if (!subject) return { candidateCount: 0, realmIds: [] as string[] };
	const candidates = await executor
		.select()
		.from(accessMembership)
		.where(
			and(
				eq(accessMembership.subjectId, subject.id),
				sql`${accessMembership.activeGeneration} is not null`,
			),
		)
		.orderBy(accessMembership.scopeId)
		.limit(257);
	if (candidates.length > 256) throw new AccessUnavailable();
	if (!candidates.length) return { candidateCount: 0, realmIds: [] as string[] };
	const realms = (
		await executor.execute<{ id: string }>(
			sql`select r.target_realm_id as id from public.access_scope sc join public.reference_value r on r.id=sc.unit_ref where sc.id in (${sql.join(
				candidates.map((row) => sql`${row.scopeId}::uuid`),
				sql`, `,
			)}) and r.target_realm_id is not null and public.access_membership_scope_is_eligible(sc.id) is true and not exists(select 1 from public.realm_enforcement e where e.scope_id=sc.id and e.subject_id=${subject.id}::uuid and e.state<>'clear')`,
		)
	).rows;
	return { candidateCount: candidates.length, realmIds: realms.map((row) => row.id) };
}
