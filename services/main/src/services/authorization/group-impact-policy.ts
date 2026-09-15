import { readMixedRealmAccessManager } from "./mixed-realm-access-manager";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { AccessManagementPermissionDefinitions, PlatformCapabilityDefinitions, UnitPermissionDefinitions, isUnitPermissionApplicable, isUnitPermissionDelegable, scopeCovers, type AccessManagementPermission } from "@rezics/access";
import type { PrincipalRequestContext } from "../auth/principal-session";
import type { DatabaseTransaction } from "../database";
import { unitAccessRestriction } from "../database/schema/access";
import { accessSubject } from "../database/schema/access-identity";
import { resolveReferenceValue } from "../units/reference-value";
import { readAccessSubjectEligibility } from "./subject-eligibility";
import { resolveAccessScope } from "./identities";
import { scopeLifecycleAdmission } from "./scope-policy";
import { readManagementAuthority } from "./management-authority";
import { lockUnitAccessState } from "./unit/access-lock";
import { accessMembership } from "../database/schema/access-membership";
import { accessScope } from "../database/schema/access-identity";
import { referenceValue } from "../database/schema/reference-value";
import { AccessRecordUnavailable } from "./http-errors";
import { GroupImpactDeltaUnavailable, type GroupImpactEffect } from "./group-impact-delta";

/** Live policy facts are an independent gate; restrictions never reduce a requested confer set. @internal */
export interface GroupImpactCurrentPolicy {
	outcome: "allow" | "deny" | "unavailable";
	reason: string | null;
	validUntil: number | null;
	subjects: { subjectId: string; action: "read" | "write" | "contribute"; outcome: "allow" | "deny" | "unavailable"; validUntil: number | null }[];
	/** Complete bounded matching deny rows remain private for protected recovery analysis. */
	restrictions: { effectOrdinal: number; restrictionId: string; permission: string; scope: string[]; before: boolean; after: boolean }[];
}

/**
 * Reload source, recipient and native resource policy under current fences.
 * @internal
 * @remarks These facts are never reused across transactions. Logical descendant paths
 * stay symbolic and retain applicable deny overlays. Realm access-manager
 * usersets use their bounded nonrecursive mixed-subject owner.
 * This policy result does not establish protected recovery or independent approval.
 */
export async function readGroupImpactCurrentPolicy(tx: DatabaseTransaction, effects: GroupImpactEffect[]): Promise<GroupImpactCurrentPolicy> {
	const entityIds = [...new Set(effects.flatMap(effect => effect.entityId ? [effect.entityId] : []))].sort();
	if (entityIds.length > 256) throw new GroupImpactDeltaUnavailable("budget");
	const entities = entityIds.length ? await tx.select().from(accessSubject).where(inArray(accessSubject.entityId,entityIds)) : [];
	if (entities.length !== entityIds.length) throw new GroupImpactDeltaUnavailable("missing");
	const subjectIds = [...new Set([...effects.flatMap(effect => [effect.subjectId,...effect.dependencySubjectIds]),...entities.map(entity => entity.id)])].sort();
	const scopeIds = [...new Set(effects.flatMap(effect => effect.scopeId ? [effect.scopeId] : []))].sort();
	if (subjectIds.length > 256 || scopeIds.length > 64) throw new GroupImpactDeltaUnavailable("budget");
	const result: GroupImpactCurrentPolicy = { outcome: "allow",reason: null,validUntil: null,subjects: [],restrictions: [] };
	function unavailable(reason: string) { result.outcome = "unavailable"; result.reason = reason; }
	function deny(reason: string) { if (result.outcome !== "unavailable") { result.outcome = "deny"; result.reason = reason; } }
	const subjects = subjectIds.length ? await tx.select().from(accessSubject).where(inArray(accessSubject.id,subjectIds)) : [];
	if (subjects.length !== subjectIds.length) throw new GroupImpactDeltaUnavailable("missing");
	const bySubject = new Map(subjects.map(subject => [subject.id,subject]));
	const entitySubjects = new Map(entities.map(entity => [entity.entityId,entity.id]));
	let work = 0;
	function charge() { if (++work > 65536) throw new GroupImpactDeltaUnavailable("budget"); }
	const requiredActions = new Map<string,Set<string>>();
	for (const effect of effects) if (effect.confer) for (const permission of effect.after) {
		const operation = permission.family === "unit" ? UnitPermissionDefinitions[permission.key].action : permission.family === "platform"
			? PlatformCapabilityDefinitions[permission.key].action : AccessManagementPermissionDefinitions[permission.key].action;
		const action = operation === "read" ? "read" : operation === "create" || permission.key === "realm.contribute" ? "contribute" : "write";
		for (const subjectId of new Set([effect.subjectId,...effect.dependencySubjectIds,...(effect.entityId ? [entitySubjects.get(effect.entityId)] : [])])) {
			charge(); if (!subjectId) throw new GroupImpactDeltaUnavailable("missing");
			const actions = requiredActions.get(subjectId) ?? new Set<string>(); actions.add(action); requiredActions.set(subjectId,actions);
		}
	}
	// Retain all three classifications. A suspension or contribution ban must not be
	// rewritten as loss of the source's permission snapshot or a smaller approval.
	for (const action of ["read", "write", "contribute"] as const) {
		const policy = await readAccessSubjectEligibility(tx,{ subjectIds,action });
		for (const fact of policy) {
			result.subjects.push({ subjectId: fact.subjectId,action,outcome: fact.outcome,validUntil: fact.validUntil ?? null });
			if (fact.validUntil !== undefined) result.validUntil = Math.min(result.validUntil ?? Infinity,fact.validUntil);
			if (fact.outcome === "unavailable") unavailable("subject-policy");
			if (fact.outcome === "deny" && requiredActions.get(fact.subjectId)?.has(action)) deny("recipient-policy");
		}
	}
	let candidates = 0;
	const realmScopes = new Map<string,string | null>(), realmMembers = new Map<string,boolean>();
 const realmManagers = new Map<string,Awaited<ReturnType<typeof readMixedRealmAccessManager>>>();
	for (const scopeId of scopeIds) {
		const target = await resolveAccessScope(tx,scopeId);
		if (!target) throw new GroupImpactDeltaUnavailable("missing");
		const lifecycle = await scopeLifecycleAdmission(tx,scopeId,true);
		const current = (await tx.execute<{ allowed: boolean | null }>(sql`select (${lifecycle}) as allowed`)).rows[0]?.allowed;
		if (current === false) deny("resource-lifecycle"); else if (current !== true) unavailable("resource-lifecycle");
		const selected = effects.map((effect,index) => ({ effect,ordinal: index+1 })).filter(({ effect }) => effect.scopeId === scopeId);
		if (target.kind !== "resource") {
			if (selected.some(({ effect }) => effect.after.some(permission => permission.family === "unit" || (permission.family === "platform" && target.kind !== "platform")))) deny("permission-applicability");
			continue;
		}
		const reference = await resolveReferenceValue(tx,target.referenceValueId);
		if (!reference) throw new GroupImpactDeltaUnavailable("missing");
		await lockUnitAccessState(tx,[reference.id],"shared");
		for (const { effect } of selected) for (const permission of effect.after) {
			if (permission.family === "platform" || (permission.family === "unit" && (!isUnitPermissionDelegable(permission.key) || !isUnitPermissionApplicable(reference.owner === "realm" || reference.owner === "entity" || reference.owner === "zone" ? reference.owner : "unit",permission.key)))) deny("permission-applicability");
		}
		// Index begins with concrete unit_id. Read all potentially overlapping masks,
		// including descendant scopes; no complete subset is produced on overflow.
		const rows = await tx.select().from(unitAccessRestriction).where(and(eq(unitAccessRestriction.unitId,reference.id),isNull(unitAccessRestriction.revokedAt)))
			.orderBy(unitAccessRestriction.id).limit(257);
		candidates += rows.length;
		if (rows.length > 256 || candidates > 4096) throw new GroupImpactDeltaUnavailable("budget");
		const now = (await tx.execute<{ now: string }>(sql`select clock_timestamp()::text as now`)).rows[0]?.now;
		if (!now || !Number.isFinite(new Date(now).getTime())) throw new GroupImpactDeltaUnavailable("missing");
		for (const row of rows) {
			if (row.expiresAt !== null) {
				if (row.expiresAt <= new Date(now)) continue;
				result.validUntil = Math.min(result.validUntil ?? Infinity,row.expiresAt.getTime());
			}
			for (const { effect,ordinal } of selected) {
				charge();
				if (![...effect.before,...effect.after].some(permission => permission.family === "unit" && permission.key === row.permission) ||
					(!scopeCovers(row.scope,effect.targetPath) && !scopeCovers(effect.targetPath,row.scope))) continue;
				const subject = bySubject.get(effect.subjectId);
				if (!subject) throw new GroupImpactDeltaUnavailable("missing");
				let matches = row.subjectKind === "auth" && row.authUserId === subject.authUserId;
				if (row.subjectKind === "realm") {
					if (row.realmRelation === "access_manager") {
      if (!row.realmId) throw new GroupImpactDeltaUnavailable("missing");
      const key = `${row.realmId}:${effect.subjectId}`;
      let manager = realmManagers.get(key);
      if (!manager) {
       if (realmManagers.size>=256) throw new GroupImpactDeltaUnavailable("budget");
       manager = await readMixedRealmAccessManager(tx,row.realmId,effect.subjectId); realmManagers.set(key,manager);
      }
      if (manager.validUntil !== null) result.validUntil = Math.min(result.validUntil ?? Infinity,manager.validUntil);
      if (manager.allowed) result.restrictions.push({ effectOrdinal: ordinal,restrictionId: row.id,permission: row.permission,scope: row.scope,
       before: effect.before.some(permission => permission.family === "unit" && permission.key === row.permission),
       after: effect.after.some(permission => permission.family === "unit" && permission.key === row.permission) });
      if (result.restrictions.length > 4096) throw new GroupImpactDeltaUnavailable("budget");
      continue;
     }
					if (row.realmRelation !== "member") { unavailable("realm-member-policy"); continue; }
					if (!row.realmId) throw new GroupImpactDeltaUnavailable("missing");
					if (!realmScopes.has(row.realmId)) {
						if (realmScopes.size >= 64) throw new GroupImpactDeltaUnavailable("budget");
						const scopes = (await tx.execute<{ id: string }>(sql`select s.id from public.access_scope s join public.reference_value r on r.id=s.unit_ref
							where r.target_realm_id=${row.realmId}::uuid limit 2`)).rows;
						if (scopes.length > 1) throw new GroupImpactDeltaUnavailable("missing");
						realmScopes.set(row.realmId,scopes[0]?.id ?? null);
					}
					const realmScope = realmScopes.get(row.realmId);
					if (!realmScope) { unavailable("realm-member-policy"); continue; }
					const key = `${realmScope}:${effect.subjectId}`;
					if (!realmMembers.has(key)) {
						if (realmMembers.size >= 256) throw new GroupImpactDeltaUnavailable("budget");
						await tx.execute(sql`select public.lock_access_membership_keys(array[${realmScope}::uuid],${effect.subjectId}::uuid,false)`);
						const [member] = await tx.select().from(accessMembership).where(and(eq(accessMembership.scopeId,realmScope),eq(accessMembership.subjectId,effect.subjectId))).for("share");
						realmMembers.set(key,member !== undefined && member.activeGeneration !== null);
					}
					matches = realmMembers.get(key) === true;
				}
				if (matches) {
					result.restrictions.push({ effectOrdinal: ordinal,restrictionId: row.id,permission: row.permission,scope: row.scope,
						before: effect.before.some(permission => permission.family === "unit" && permission.key === row.permission),
						after: effect.after.some(permission => permission.family === "unit" && permission.key === row.permission) });
					if (result.restrictions.length > 4096) throw new GroupImpactDeltaUnavailable("budget");
				}
			}
		}
	}
	const clock = (await tx.execute<{ now: string }>(sql`select clock_timestamp()::text as now`)).rows[0]?.now;
	if (!clock || !Number.isFinite(new Date(clock).getTime())) throw new GroupImpactDeltaUnavailable("missing");
	if (result.validUntil !== null && new Date(clock).getTime() >= result.validUntil) unavailable("policy-expired");
	if (effects.some(effect => effect.scopeId === null)) unavailable("all-scope-resource-policy");
	return result;
}

/** Reauthorize each distinct confer target from the current actor/credential/representation selection. @internal */
export async function readGroupImpactConferAuthority(tx: DatabaseTransaction, context: PrincipalRequestContext, effects: GroupImpactEffect[]) {
 const targets = new Map<string,{ scopeId: string; path: string[]; permission: AccessManagementPermission }>();
 for (const effect of effects) if (effect.confer) {
  let scopeId = effect.scopeId;
  const permission = effect.kind === "binding" ? "access.role-binding.manage" : effect.kind === "ceiling" ? "access.assignment-ceiling.manage" : "access.representation.manage";
  if (effect.kind === "representation") {
   if (!effect.entityId) throw new GroupImpactDeltaUnavailable("missing");
   const [root] = await tx.select({ id: accessScope.id }).from(accessScope).innerJoin(referenceValue,eq(accessScope.unitRef,referenceValue.id))
    .where(eq(referenceValue.targetEntityId,effect.entityId));
   scopeId = root?.id ?? null;
  }
  if (!scopeId) throw new GroupImpactDeltaUnavailable("missing");
  const path = effect.kind === "representation" ? [] : effect.targetPath;
  targets.set(`${scopeId}:${JSON.stringify(path)}:${permission}`,{ scopeId,path,permission });
 }
 if (targets.size > 64) throw new GroupImpactDeltaUnavailable("budget");
 const authorities = [];
 for (const target of [...targets.values()].sort((a,b) => a.scopeId.localeCompare(b.scopeId) || JSON.stringify(a).localeCompare(JSON.stringify(b)))) {
  try {
   const lifecycle = await scopeLifecycleAdmission(tx,target.scopeId,true);
   authorities.push(await readManagementAuthority(tx,{ proof: context.credentialProof(),selection: context.selection,scopeId: target.scopeId,
    path: target.path,permission: target.permission,apiPermission: "access:manage",requireFreshSession: true,mutation: true },lifecycle));
  } catch (error) { if (error instanceof AccessRecordUnavailable) throw new GroupImpactDeltaUnavailable("missing"); throw error; }
 }
 return authorities;
}
