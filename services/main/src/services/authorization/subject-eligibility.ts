import { inArray, sql } from "drizzle-orm";
import { z } from "zod";
import type { AccessSubjectTarget } from "@rezics/access";
import type { DatabaseTransaction } from "../database";
import { accessSubject } from "../database/schema/access-identity";
import { users } from "../database/schema/auth";
import { userAccountState } from "../database/schema/account-control";
import { entityIdentity } from "../database/schema/catalog-identity";
import { entityParticipation } from "../database/schema/participation";
import { EnforcementKindValues } from "../database/schema/contract-values";
import { doesEnforcementBlockAction } from "./account/policy";
import type { AuthorityOutcome } from "./authority-context";

/** Current identity lifecycle contribution, with the first known time boundary requiring reevaluation. @internal */
export interface AccessSubjectEligibility {
	subjectId: string;
	subject: AccessSubjectTarget;
	outcome: AuthorityOutcome;
	evaluatedAt: Date;
	validUntil?: number;
}
/** Required subject policy cannot be resolved completely within this transaction. @internal */
export class AccessSubjectPolicyUnavailable extends Error {
	constructor() { super("Current subject policy is unavailable or exceeds its work budget"); }
}

/**
 * Read current private account or admitted Entity eligibility under concrete owner fences.
 * @internal
 * @remarks The domain owner selects read/write/contribute; this is not a client
 * override. READ COMMITTED is required for fresh policy statements after owner
 * lock waits, including when a mutable policy row has not yet been created.
 * Account state applies to every action, while existing enforcement
 * semantics distinguish writes from contributions. Entity publication visibility
 * is not participation eligibility. Scope bans/restrictions, credential policy,
 * representation, assignment authority and independent approvals remain separate.
 * At most 256 subjects, 256 nonrevoked enforcements per principal and 512 total
 * enforcement candidates are read; exhaustion never produces a partial allow.
 */
export async function readAccessSubjectEligibility(
	tx: DatabaseTransaction,
	input: { subjectIds: string[]; action: "read" | "write" | "contribute" },
): Promise<AccessSubjectEligibility[]> {
	const request = z.strictObject({ subjectIds: z.array(z.uuid()).max(256), action: z.enum(["read", "write", "contribute"]) }).parse(input);
	const isolation = (await tx.execute<{ isolation: string }>(sql`select current_setting('transaction_isolation') as isolation`)).rows[0]?.isolation;
	if (isolation !== "read committed") throw new AccessSubjectPolicyUnavailable();
	const subjectIds = [...new Set(request.subjectIds)].sort();
	if (!subjectIds.length) return [];
	const subjects = await tx.select().from(accessSubject).where(inArray(accessSubject.id, subjectIds));
	if (subjects.length !== subjectIds.length) throw new AccessSubjectPolicyUnavailable();
	const principalIds = [...new Set(subjects.flatMap(subject => subject.authUserId ? [subject.authUserId] : []))].sort();
	const entityIds = [...new Set(subjects.flatMap(subject => subject.entityId ? [subject.entityId] : []))].sort();
	const accounts = principalIds.length ? await tx.select({ id: users.id, erasedAt: users.erasedAt }).from(users)
		.where(inArray(users.id, principalIds)).orderBy(users.id).for("share") : [];
	if (accounts.length !== principalIds.length) throw new AccessSubjectPolicyUnavailable();
	const entities = entityIds.length ? await tx.select({ id: entityIdentity.id, deletedAt: entityIdentity.deletedAt }).from(entityIdentity)
		.where(inArray(entityIdentity.id, entityIds)).orderBy(entityIdentity.id).for("share") : [];
	if (entities.length !== entityIds.length) throw new AccessSubjectPolicyUnavailable();
	const states = principalIds.length ? await tx.select().from(userAccountState).where(inArray(userAccountState.userId, principalIds)) : [];
	const participation = entityIds.length ? await tx.select().from(entityParticipation).where(inArray(entityParticipation.entityId, entityIds)) : [];
	const nonErased = accounts.filter(account => account.erasedAt === null).map(account => account.id);
	const action = request.action;
	const blockingKinds = action === "read" ? [] : EnforcementKindValues.filter(kind => doesEnforcementBlockAction(kind, action));
	const enforcements = request.action !== "read" && nonErased.length ? (await tx.execute<{
		auth_user_id: string; kind: string; starts_at: string; expires_at: string | null;
	}>(sql`
		select e.auth_user_id,e.kind,e.starts_at::text,e.expires_at::text
		from (values ${sql.join(nonErased.map(id => sql`(${id}::uuid)`), sql`, `)}) account(id)
		cross join lateral(select auth_user_id,kind,starts_at,expires_at from public.account_enforcement e
			where e.auth_user_id=account.id and e.revocation_action_id is null
				and e.kind in (${sql.join(blockingKinds.map(kind => sql`${kind}`), sql`, `)}) order by e.kind,e.id limit 257) e
		limit 513`)).rows : [];
	if (enforcements.length > 512) throw new AccessSubjectPolicyUnavailable();
	const byPrincipal = new Map<string, typeof enforcements>();
	for (const row of enforcements) {
		const rows = byPrincipal.get(row.auth_user_id) ?? [];
		rows.push(row); byPrincipal.set(row.auth_user_id, rows);
		if (rows.length > 256) throw new AccessSubjectPolicyUnavailable();
	}
	const time = (await tx.execute<{ now: string }>(sql`select clock_timestamp()::text as now`)).rows[0]?.now;
	const evaluatedAt = new Date(time ?? "invalid");
	if (!Number.isFinite(evaluatedAt.getTime())) throw new AccessSubjectPolicyUnavailable();
	const now = evaluatedAt.getTime();
	const accountRows = new Map(accounts.map(account => [account.id, account]));
	const stateRows = new Map(states.map(state => [state.userId, state]));
	const entityRows = new Map(entities.map(entity => [entity.id, entity]));
	const participationRows = new Map(participation.map(member => [member.entityId, member]));
	return subjects.map(subject => {
		if (subject.authUserId !== null) {
			const account = accountRows.get(subject.authUserId);
			if (!account) throw new AccessSubjectPolicyUnavailable();
			const state = stateRows.get(account.id);
			if (account.erasedAt !== null || state?.state === "closed")
				return { subjectId: subject.id, subject: { kind: "principal" as const, id: account.id }, outcome: "deny" as const, evaluatedAt };
			const stateExpiry = state?.expiresAt?.getTime();
			if (stateExpiry !== undefined && !Number.isFinite(stateExpiry)) throw new AccessSubjectPolicyUnavailable();
			let outcome: AuthorityOutcome = state?.state === "suspended" && (stateExpiry === undefined || stateExpiry > now) ? "deny" : "allow";
			let validUntil = stateExpiry !== undefined && stateExpiry > now ? stateExpiry : undefined;
			for (const row of byPrincipal.get(account.id) ?? []) {
				if (request.action === "read" || !doesEnforcementBlockAction(row.kind, request.action)) continue;
				const start = new Date(row.starts_at).getTime(), end = row.expires_at === null ? null : new Date(row.expires_at).getTime();
				if (!Number.isFinite(start) || (end !== null && !Number.isFinite(end))) throw new AccessSubjectPolicyUnavailable();
				if (start <= now && (end === null || end > now)) outcome = "deny";
				for (const boundary of [start, end]) if (boundary !== null && boundary > now)
					validUntil = validUntil === undefined ? boundary : Math.min(validUntil, boundary);
			}
			return { subjectId: subject.id, subject: { kind: "principal" as const, id: account.id }, outcome, evaluatedAt,
				...(validUntil !== undefined ? { validUntil } : {}) };
		}
		const entityId = z.uuid().parse(subject.entityId), entity = entityRows.get(entityId);
		if (!entity) throw new AccessSubjectPolicyUnavailable();
		const active = entity.deletedAt === null && participationRows.get(entityId)?.state === "active";
		return { subjectId: subject.id, subject: { kind: "entity" as const, id: entityId },
			outcome: active ? "allow" as const : "deny" as const, evaluatedAt };
	});
}
