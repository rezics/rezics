import { eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import type { AccessSubjectTarget } from "@rezics/access";
import type { DatabaseTransaction } from "../database";
import { accessScope, accessSubject } from "../database/schema/access-identity";
import { users } from "../database/schema/auth";
import { userAccountState } from "../database/schema/account-control";
import { entityIdentity } from "../database/schema/catalog-identity";
import { entityParticipation } from "../database/schema/participation";
import { workloadPrincipal } from "../database/schema/workload-principal";
import { realm } from "../database/schema/realm";
import { connectedInstallation } from "../database/schema/connected-installation";
import { connectedApp } from "../database/schema/connected-app";
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
 * At most 256 subjects and 256 concrete accounts/Entities/Realms including workload
 * owners, 256 nonrevoked enforcements per principal and 512 total
 * enforcement candidates are read; exhaustion never produces a partial allow.
 */
export async function readAccessSubjectEligibility(
	tx: DatabaseTransaction,
	input: { subjectIds: string[]; action: "read" | "write" | "contribute" },
): Promise<AccessSubjectEligibility[]> {
	const request = z.strictObject({ subjectIds: z.array(z.uuid().toLowerCase()).max(256), action: z.enum(["read", "write", "contribute"]) }).parse(input);
	const isolation = (await tx.execute<{ isolation: string }>(sql`select current_setting('transaction_isolation') as isolation`)).rows[0]?.isolation;
	if (isolation !== "read committed") throw new AccessSubjectPolicyUnavailable();
	const subjectIds = [...new Set(request.subjectIds)].sort();
	if (!subjectIds.length) return [];
	const subjects = await tx.select().from(accessSubject).where(inArray(accessSubject.id, subjectIds));
	if (subjects.length !== subjectIds.length) throw new AccessSubjectPolicyUnavailable();
	const principalIds = [...new Set(subjects.flatMap(subject => subject.authUserId ? [subject.authUserId] : []))].sort();
	const accounts = principalIds.length ? await tx.select({ id: users.id, kind: users.principalKind, erasedAt: users.erasedAt }).from(users)
		.where(inArray(users.id, principalIds)).orderBy(users.id).for("share") : [];
	if (accounts.length !== principalIds.length) throw new AccessSubjectPolicyUnavailable();
	const serviceIds = accounts.filter(account => account.kind === "service").map(account => account.id);
	const workloads = serviceIds.length ? await tx.select().from(workloadPrincipal).where(inArray(workloadPrincipal.authUserId, serviceIds)) : [];
	const activeWorkloads = workloads.filter(value => value.state === "active" && value.version > 0);
	const installationWorkloadIds = activeWorkloads.filter(value => value.purpose === "installation").map(value => value.authUserId);
	const installations = installationWorkloadIds.length ? await tx.select().from(connectedInstallation)
		.where(inArray(connectedInstallation.workloadPrincipalId, installationWorkloadIds)) : [];
	const activeInstallations = installations.filter(value => value.state === "active");
	if (activeInstallations.some(value => value.approvedRevision === null)) throw new AccessSubjectPolicyUnavailable();
	const appIds = [...new Set(activeInstallations.map(value => value.appId))].sort();
	const apps = appIds.length ? await tx.select().from(connectedApp).where(inArray(connectedApp.id, appIds)).orderBy(connectedApp.id).for("share") : [];
	if (apps.length !== appIds.length) throw new AccessSubjectPolicyUnavailable();
	const approvals = activeInstallations.length ? (await tx.execute<{ installation_id: string; valid_from: string; valid_until: string | null; sealed: boolean }>(sql`
		select r.installation_id,r.valid_from::text,r.valid_until::text,r.sealed from (values
		${sql.join(activeInstallations.map(value => sql`(${value.id}::uuid,${value.approvedRevision}::bigint)`), sql`, `)}) selected(id,revision)
		join public.connected_installation_revision r on r.installation_id=selected.id and r.revision=selected.revision`)).rows : [];
	if (approvals.length !== activeInstallations.length || approvals.some(value => !value.sealed)) throw new AccessSubjectPolicyUnavailable();
	const ownerScopeIds = [...new Set([...activeWorkloads.map(value => value.ownerScopeId), ...apps.map(value => value.scopeId)])].sort();
	if (ownerScopeIds.length > 256) throw new AccessSubjectPolicyUnavailable();
	const ownerScopes = ownerScopeIds.length ? (await tx.execute<{
		id: string; platform_root: string | null; auth_user_id: string | null; entity_id: string | null; realm_id: string | null;
	}>(sql`select s.id,s.platform_root,s.auth_user_id,r.target_entity_id as entity_id,r.target_realm_id as realm_id
		from public.access_scope s left join public.reference_value r on r.id=s.unit_ref
		where s.id in (${sql.join(ownerScopeIds.map(id => sql`${id}::uuid`), sql`, `)})`)).rows : [];
	if (ownerScopes.length !== ownerScopeIds.length) throw new AccessSubjectPolicyUnavailable();
	const ownerPrincipalIds = [...new Set(ownerScopes.flatMap(scope => scope.auth_user_id ? [scope.auth_user_id] : []))].filter(id => !principalIds.includes(id)).sort();
	const allPrincipalIds = [...new Set([...principalIds, ...ownerPrincipalIds])].sort();
	const entityIds = [...new Set([...subjects.flatMap(subject => subject.entityId ? [subject.entityId] : []),
		...ownerScopes.flatMap(scope => scope.entity_id ? [scope.entity_id] : [])])].sort();
	const realmIds = [...new Set(ownerScopes.flatMap(scope => scope.realm_id ? [scope.realm_id] : []))].sort();
	if (allPrincipalIds.length + entityIds.length + realmIds.length > 256) throw new AccessSubjectPolicyUnavailable();
	const ownerAccounts = ownerPrincipalIds.length ? await tx.select({ id: users.id, kind: users.principalKind, erasedAt: users.erasedAt }).from(users)
		.where(inArray(users.id, ownerPrincipalIds)).orderBy(users.id).for("share") : [];
	if (ownerAccounts.length !== ownerPrincipalIds.length) throw new AccessSubjectPolicyUnavailable();
	accounts.push(...ownerAccounts);
	const appOwnerIds = new Set(ownerScopes.filter(scope => apps.some(app => app.scopeId === scope.id)).flatMap(scope => scope.auth_user_id ? [scope.auth_user_id] : []));
	const systemAppOwnerIds = accounts.filter(account => appOwnerIds.has(account.id) && account.kind === "service").map(account => account.id);
	const systemAppOwners = systemAppOwnerIds.length ? await tx.select({ principalId: workloadPrincipal.authUserId,
		purpose: workloadPrincipal.purpose, state: workloadPrincipal.state, root: accessScope.platformRoot }).from(workloadPrincipal)
		.innerJoin(accessScope, eq(accessScope.id, workloadPrincipal.ownerScopeId)).where(inArray(workloadPrincipal.authUserId, systemAppOwnerIds)) : [];
	const entities = entityIds.length ? await tx.select({ id: entityIdentity.id, shape: entityIdentity.shape, deletedAt: entityIdentity.deletedAt }).from(entityIdentity)
		.where(inArray(entityIdentity.id, entityIds)).orderBy(entityIdentity.id).for("share") : [];
	if (entities.length !== entityIds.length) throw new AccessSubjectPolicyUnavailable();
	const realms = realmIds.length ? await tx.select({ id: realm.id, deletedAt: realm.deletedAt }).from(realm)
		.where(inArray(realm.id, realmIds)).orderBy(realm.id).for("share") : [];
	if (realms.length !== realmIds.length) throw new AccessSubjectPolicyUnavailable();
	const states = allPrincipalIds.length ? await tx.select().from(userAccountState).where(inArray(userAccountState.userId, allPrincipalIds)) : [];
	const participation = entityIds.length ? await tx.select().from(entityParticipation).where(inArray(entityParticipation.entityId, entityIds)) : [];
	const enforcedOwnerIds = new Set(ownerScopes.filter(scope => activeWorkloads.some(workload => workload.ownerScopeId === scope.id)).flatMap(scope => scope.auth_user_id ? [scope.auth_user_id] : []));
	const nonErased = accounts.filter(account => account.erasedAt === null && (principalIds.includes(account.id) || enforcedOwnerIds.has(account.id))).map(account => account.id);
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
	const realmRows = new Map(realms.map(value => [value.id, value]));
	const workloadRows = new Map(workloads.map(value => [value.authUserId, value]));
	const scopeRows = new Map(ownerScopes.map(value => [value.id, value]));
	const installationRows = new Map(installations.map(value => [value.workloadPrincipalId, value]));
	const appRows = new Map(apps.map(value => [value.id, value]));
	const approvalRows = new Map(approvals.map(value => [value.installation_id, value]));
	const systemOwnerRows = new Map(systemAppOwners.map(value => [value.principalId, value]));
	function accountPolicy(accountId: string, enforce = true): { outcome: AuthorityOutcome; validUntil?: number } {
		const account = accountRows.get(accountId);
		if (!account) throw new AccessSubjectPolicyUnavailable();
		const state = stateRows.get(account.id);
		if (account.erasedAt !== null || state?.state === "closed") return { outcome: "deny" };
		const stateExpiry = state?.expiresAt?.getTime();
		if (stateExpiry !== undefined && !Number.isFinite(stateExpiry)) throw new AccessSubjectPolicyUnavailable();
		let outcome: AuthorityOutcome = state?.state === "suspended" && (stateExpiry === undefined || stateExpiry > now) ? "deny" : "allow";
		let validUntil = stateExpiry !== undefined && stateExpiry > now ? stateExpiry : undefined;
		for (const row of byPrincipal.get(account.id) ?? []) {
			if (!enforce || request.action === "read" || !doesEnforcementBlockAction(row.kind, request.action)) continue;
			const start = new Date(row.starts_at).getTime(), end = row.expires_at === null ? null : new Date(row.expires_at).getTime();
			if (!Number.isFinite(start) || (end !== null && !Number.isFinite(end))) throw new AccessSubjectPolicyUnavailable();
			if (start <= now && (end === null || end > now)) outcome = "deny";
			for (const boundary of [start, end]) if (boundary !== null && boundary > now)
				validUntil = validUntil === undefined ? boundary : Math.min(validUntil, boundary);
		}
		return { outcome, ...(validUntil !== undefined ? { validUntil } : {}) };
	}
	return subjects.map(subject => {
		if (subject.authUserId !== null) {
			const account = accountRows.get(subject.authUserId);
			if (!account) throw new AccessSubjectPolicyUnavailable();
			let { outcome, validUntil } = accountPolicy(account.id);
			if (account.kind === "service") {
				const workload = workloadRows.get(account.id), scope = workload ? scopeRows.get(workload.ownerScopeId) : undefined;
				if (!workload || workload.version < 1 || workload.state !== "active" || !scope) outcome = "deny";
				else if (workload.purpose === "system") {
					if (scope.platform_root !== "platform") outcome = "deny";
				} else if (scope.auth_user_id) {
					if (accountRows.get(scope.auth_user_id)?.kind !== "human") outcome = "deny";
					else {
						const owner = accountPolicy(scope.auth_user_id);
						if (owner.outcome !== "allow") outcome = owner.outcome;
						if (owner.validUntil !== undefined) validUntil = validUntil === undefined ? owner.validUntil : Math.min(validUntil, owner.validUntil);
					}
				} else if (scope.entity_id) {
					const owner = entityRows.get(scope.entity_id);
					if (!owner || owner.shape !== "organization" || owner.deletedAt !== null || participationRows.get(scope.entity_id)?.state !== "active") outcome = "deny";
				} else if (scope.realm_id) {
					if (!realmRows.has(scope.realm_id) || realmRows.get(scope.realm_id)?.deletedAt !== null) outcome = "deny";
				} else outcome = "deny";
				if (workload?.purpose === "installation" && workload.state === "active") {
					const installation = installationRows.get(account.id);
					const approval = installation ? approvalRows.get(installation.id) : undefined;
					const app = installation ? appRows.get(installation.appId) : undefined;
					const appScope = app ? scopeRows.get(app.scopeId) : undefined;
					if (!installation || installation.state !== "active" || !approval || !app || app.state !== "active" || app.trust === "blocked" || !appScope) outcome = "deny";
					else {
						const start = new Date(approval.valid_from).getTime(), end = approval.valid_until === null ? null : new Date(approval.valid_until).getTime();
						if (!Number.isFinite(start) || (end !== null && !Number.isFinite(end))) throw new AccessSubjectPolicyUnavailable();
						if (start > now || (end !== null && end <= now)) outcome = "deny";
						for (const boundary of [start, end]) if (boundary !== null && boundary > now) validUntil = validUntil === undefined ? boundary : Math.min(validUntil, boundary);
						if (appScope.auth_user_id) {
							const owner = accountRows.get(appScope.auth_user_id), policy = accountPolicy(appScope.auth_user_id, false);
							if (policy.outcome !== "allow") outcome = policy.outcome;
							if (policy.validUntil !== undefined) validUntil = validUntil === undefined ? policy.validUntil : Math.min(validUntil, policy.validUntil);
							if (owner?.kind === "service") {
								const duty = systemOwnerRows.get(appScope.auth_user_id);
								if (!duty || duty.purpose !== "system" || duty.state !== "active" || duty.root !== "platform") outcome = "deny";
							}
						} else if (appScope.entity_id) {
							if (entityRows.get(appScope.entity_id)?.deletedAt !== null || participationRows.get(appScope.entity_id)?.state !== "active") outcome = "deny";
						} else outcome = "deny";
					}
				}
			}
			return { subjectId: subject.id, subject: { kind: "principal" as const, id: account.id }, outcome, evaluatedAt,
				...(validUntil !== undefined ? { validUntil } : {}) };
		}
		const entityId = z.uuid().toLowerCase().parse(subject.entityId), entity = entityRows.get(entityId);
		if (!entity) throw new AccessSubjectPolicyUnavailable();
		const active = entity.deletedAt === null && participationRows.get(entityId)?.state === "active";
		return { subjectId: subject.id, subject: { kind: "entity" as const, id: entityId },
			outcome: active ? "allow" as const : "deny" as const, evaluatedAt };
	});
}
