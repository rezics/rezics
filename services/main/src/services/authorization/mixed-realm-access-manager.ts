import { and, eq, isNull, sql } from "drizzle-orm";
import type { DatabaseTransaction } from "../database";
import { accessSubject } from "../database/schema/access-identity";
import { unitAccessGrant, unitAccessRestriction, unitOwnership } from "../database/schema/access";
import { readSubjectRoleBindingPermissions } from "./role-binding-permissions";
import { readAccessMemberSetRecipients } from "./member-set-recipients";
import { scopeLifecycleAdmission } from "./scope-policy";
import { requireAccessAdmission } from "./transaction";
import { lockUnitAccessState } from "./unit/access-lock";
import { AccessRecordUnavailable, AccessUnavailable } from "./http-errors";

/**
 * Bounded nonrecursive Realm access-manager userset for a native selected subject.
 * @internal
 * @remarks Compose current owner, native RoleBindings and retained literal grants;
 * member usersets use native admissions. Access-manager usersets are never followed
 * recursively, nor is an Entity mapped to an assumed private self-account.
 */
export async function readMixedRealmAccessManager(tx: DatabaseTransaction, realmId: string, subjectId: string) {
 const [subject] = await tx.select().from(accessSubject).where(eq(accessSubject.id,subjectId));
 const [scope] = (await tx.execute<{ id: string }>(sql`select s.id from public.access_scope s join public.reference_value r on r.id=s.unit_ref
  where r.target_realm_id=${realmId}::uuid`)).rows;
 if (!subject || !scope) throw new AccessUnavailable();
 try { await requireAccessAdmission(tx,await scopeLifecycleAdmission(tx,scope.id,true)); }
 catch (error) { if (error instanceof AccessRecordUnavailable) return { allowed: false,validUntil: null }; throw error; }
 await lockUnitAccessState(tx,[realmId],"shared");
 const owners = await tx.select().from(unitOwnership).where(and(eq(unitOwnership.unitRealmId,realmId),isNull(unitOwnership.revokedAt))).limit(2);
 if (owners.length > 1) throw new AccessUnavailable();
 const source = await readSubjectRoleBindingPermissions(tx,{ subjectId,targets: [{ scopeId: scope.id,path: [] }] });
 const grantCandidates: (typeof unitAccessGrant.$inferSelect)[] = [];
 // Each existing active-subject index begins with unit_id. Probe whole bounded
 // candidate sets before filtering permissions, so tombstones/other permissions
 // cannot turn a LIMIT into an unbounded scan of a hot Realm.
 for (const kind of ["auth","realm","authenticated"] as const) {
  grantCandidates.push(...await tx.select().from(unitAccessGrant).where(and(eq(unitAccessGrant.unitId,realmId),eq(unitAccessGrant.subjectKind,kind),
   isNull(unitAccessGrant.revokedAt))).limit(257));
  if (grantCandidates.length>256) throw new AccessUnavailable();
 }
 const restrictionCandidates = await tx.select().from(unitAccessRestriction).where(and(eq(unitAccessRestriction.unitId,realmId),isNull(unitAccessRestriction.revokedAt)))
  .orderBy(unitAccessRestriction.id).limit(257);
 if (restrictionCandidates.length>256) throw new AccessUnavailable();
 const grants = grantCandidates.filter(row => row.permission==="unit.access.manage" && row.scope.length===0);
 const restrictions = restrictionCandidates.filter(row => row.permission==="unit.access.manage" && row.scope.length===0);
 const memberScopes = new Map<string,string>();
 for (const row of [...grants,...restrictions]) if (row.realmId && row.realmRelation === "member" && !memberScopes.has(row.realmId)) {
  if (memberScopes.size >= 64) throw new AccessUnavailable();
  const [root] = (await tx.execute<{ id: string }>(sql`select s.id from public.access_scope s join public.reference_value r on r.id=s.unit_ref
   where r.target_realm_id=${row.realmId}::uuid`)).rows;
  if (!root) throw new AccessUnavailable();
  memberScopes.set(row.realmId,root.id);
 }
 const members = await readAccessMemberSetRecipients(tx,{ subjectId,scopeIds: [...new Set(memberScopes.values())] });
 const time = (await tx.execute<{ now: string }>(sql`select clock_timestamp()::text as now`)).rows[0]?.now;
 const now = new Date(time ?? "invalid");
 if (!Number.isFinite(now.getTime())) throw new AccessUnavailable();
 const matches = (row: typeof grants[number] | typeof restrictions[number]) => {
  if (row.expiresAt && row.expiresAt <= now) return false;
  if (row.subjectKind === "auth") return subject.authUserId !== null && row.authUserId === subject.authUserId;
  if (row.subjectKind === "authenticated") return subject.authUserId !== null;
  return row.realmRelation === "member" && row.realmId !== null && members.recipients.some(recipient => recipient.kind === "all-members" && recipient.scopeId === memberScopes.get(row.realmId!));
 };
 const owns = subject.entityId !== null && owners.some(owner => owner.profileId === subject.entityId);
 const allowed = owns || (!restrictions.some(matches) && (grants.some(matches) || source.bindings.some(binding => binding.active &&
  binding.permissions.some(permission => permission.family === "unit" && permission.key === "unit.access.manage"))));
 const times = [...grants,...restrictions].flatMap(row => row.expiresAt && row.expiresAt > now ? [row.expiresAt.getTime()] : []);
 for (const binding of source.bindings) {
  if (binding.terms.validFrom > now) times.push(binding.terms.validFrom.getTime());
  if (binding.terms.validUntil && binding.terms.validUntil > now) times.push(binding.terms.validUntil.getTime());
 }
 return { allowed,validUntil: times.length ? Math.min(...times) : null };
}
