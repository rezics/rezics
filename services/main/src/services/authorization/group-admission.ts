import { presentGroupRecipient } from "./group-recipient-selectors";
import { readAccessSubjectEligibility } from "./subject-eligibility";
import { createHash } from "node:crypto";
import { and, eq, gt, inArray, isNull, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import type { AccessManagementPermission } from "@rezics/access";
import { PrincipalRequestContext } from "../auth/principal-context";
import { readFirstPartyCredentialAuthority } from "../auth/credential-authority";
import type { DatabaseTransaction } from "../database";
import { accessGroupImpactReview as reviews, accessGroupImpactWitness as witnesses, accessGroupImpactEffect, accessImpactFence, accessGroupImpactNode } from "@rezics/schema/postgres/access/access-group-impact";
import { accessGroupApproval as approvals, accessRecoveryPath as paths, accessRecoveryPolicy as policies, accessGroupAdmissionReceipt as receipts } from "@rezics/schema/postgres/access/access-group-admission";
import { accessSubject } from "@rezics/schema/postgres/access/access-identity";
import { accessRepresentation, accessRepresentationEntity } from "@rezics/schema/postgres/access/access-representation";
import { accessMembership } from "@rezics/schema/postgres/access/access-membership";
import { accessGroupMembershipSet, accessGroupMembership } from "@rezics/schema/postgres/access/access-group-membership";
import { accessGroupTree } from "@rezics/schema/postgres/access/access-group";
import { accessRoleBindingScope } from "@rezics/schema/postgres/access/access-role-binding";
import { RequestedAuthoritySelectionSchema } from "./authority-context";
import { groupAuthoritySourceDigest, readCompleteGroupApprovalEvidence, lockCompleteGroupImpactEvaluation } from "./group-impact-evaluation";
import { groupImpactPermission, revalidateGroupImpactDiscovery, type GroupImpactReview } from "./group-impact-discovery";
import { GroupImpactEffectSchema, type GroupImpactEffect } from "./group-impact-delta";
import { readGroupImpactConferAuthority, readGroupImpactCurrentPolicy } from "./group-impact-policy";
import { readManagementAuthority } from "./management-authority";
import { scopeLifecycleAdmission } from "./scope-policy";
import { requireAccessAdmission, runAccessTransaction, rethrowAccessFailure } from "./transaction";
import { AccessChanged, AccessDenied, AccessRecordUnavailable, AccessUnavailable } from "./http-errors";

const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const id = z.uuid().toLowerCase();
const proofSchema = z.strictObject({ kind: z.literal("session"), id, principalId: id, tokenDigest: z.string().regex(/^[0-9a-f]{64}$/) });
type Authority = Awaited<ReturnType<typeof readManagementAuthority>>;
type Evidence = Awaited<ReturnType<typeof readCompleteGroupApprovalEvidence>>;
type ReviewKey = { scopeId: string; groupId: string; reviewId: string };
const repairPermissions: AccessManagementPermission[] = ["access.role-binding.manage", "access.assignment-ceiling.manage"];
function proposalDigest(review: GroupImpactReview) {
 return hash({ reviewId: review.id, scopeId: review.scopeId, groupId: review.groupId, operation: review.operation,
  membershipId: review.membershipId, generation: review.generation, selectionVersion: review.expectedSelectionVersion,
  parentId: review.proposedParentId, groupVersion: review.expectedGroupVersion, treeVersion: review.expectedTreeVersion,
  principalId: review.operatorAuthUserId, subjectId: review.authoritySubjectId });
}
function sourcesDigest(sources: Authority[]) { return hash(sources.map(groupAuthoritySourceDigest)); }
function continuityDigest(sources: Authority[], review: GroupImpactReview, after = false) {
 const selection = (value: { membershipId: string; generation: number; setVersion: number }) => ({ ...value,
  setVersion: value.setVersion - (after && value.membershipId === review.membershipId && value.generation === review.generation ? 1 : 0) });
 // The target tree epoch advances with this command. Exact sources, membership
 // generations/selections and represented paths still must survive unchanged.
 return hash(sources.map(source => {
  const representation = source.sourceEvidence.representation;
  return groupAuthoritySourceDigest({ ...source,sourceEvidence: { ...source.sourceEvidence,trees: [],selections: source.sourceEvidence.selections.map(selection),
   representation: representation ? { ...representation,memberSets: representation.memberSets.map(set => ({ ...set,selections: set.selections.map(selection),recipients: [] })) } : null,
  } });
 }));
}
/** Decode a retained native recovery/approval proof; no caller-supplied identity is trusted. @internal */
export function recoveryPathContext(row: { principalId: string; proof: unknown; selection: unknown }) {
 const proof = proofSchema.parse(row.proof);
 if (row.principalId !== proof.principalId) throw new AccessUnavailable();
 return new PrincipalRequestContext(row.principalId, RequestedAuthoritySelectionSchema.parse(row.selection), proof);
}
async function clock(tx: DatabaseTransaction) {
 const value = (await tx.execute<{ now: string }>(sql`select clock_timestamp()::text as now`)).rows[0]?.now;
 const time = new Date(value ?? "invalid");
 if (!Number.isFinite(time.getTime())) throw new AccessUnavailable();
 return time;
}
async function witnessDigest(tx: DatabaseTransaction, review: GroupImpactReview) {
 const rows = await tx.select({ kind: witnesses.kind, key: witnesses.key, version: witnesses.version }).from(witnesses)
  .where(eq(witnesses.reviewId,review.id)).orderBy(witnesses.kind,witnesses.key).limit(8194);
 if (rows.length !== review.witnessCount || rows.length > 8193) throw new AccessUnavailable();
 return hash(rows);
}
async function authority(tx: DatabaseTransaction, context: PrincipalRequestContext, scopeId: string, permission: AccessManagementPermission, path: string[] = []) {
 return readManagementAuthority(tx,{ proof: context.credentialProof(),selection: context.selection,scopeId,path,permission,
  apiPermission: "access:manage",requireFreshSession: true,mutation: true },await scopeLifecycleAdmission(tx,scopeId,true));
}
async function entityScope(tx: DatabaseTransaction, entityId: string) {
 const rows = (await tx.execute<{ id: string }>(sql`select s.id from public.access_scope s join public.reference_value r on r.id=s.unit_ref
  where r.target_entity_id=${entityId}::uuid limit 2`)).rows;
 if (rows.length !== 1) throw new AccessUnavailable();
 return rows[0]!.id;
}
async function recoveryRoots(tx: DatabaseTransaction, review: GroupImpactReview, effects: GroupImpactEffect[]) {
 const roots = new Set([review.scopeId,...effects.flatMap(effect => effect.scopeId ? [effect.scopeId] : [])]);
 const entities = [...new Set(effects.flatMap(effect => effect.entityId ? [effect.entityId] : []))].sort();
 if (roots.size>64 || entities.length>64) throw new AccessUnavailable();
 for (const entityId of entities) roots.add(await entityScope(tx,entityId));
 if (roots.size > 64) throw new AccessUnavailable();
 return [...roots].sort();
}

/**
 * Promote the Group head/height/tree write closure before complete admission consumption.
 * @internal
 * @remarks Other native owners retain their ordinary shared fences; the Group effect
 * does not write them. Deadlocks retry the entire transaction. This reads only bounded
 * review-local records and never creates a missing source fence as evidence.
 */
export async function lockGroupAdmissionClosure(tx: DatabaseTransaction, context: PrincipalRequestContext, input: ReviewKey) {
 await tx.select().from(accessRoleBindingScope).where(eq(accessRoleBindingScope.scopeId,input.scopeId)).for("update");
 await tx.select().from(accessGroupTree).where(eq(accessGroupTree.scopeId,input.scopeId)).for("update");
 const [review] = await tx.select().from(reviews).where(and(eq(reviews.id,input.reviewId),eq(reviews.scopeId,input.scopeId),eq(reviews.groupId,input.groupId))).for("update");
 if (!review) throw new AccessRecordUnavailable();
 if (review.membershipId && review.generation !== null) {
  await tx.select().from(accessMembership).where(eq(accessMembership.id,review.membershipId)).for("share");
  const [set] = await tx.select().from(accessGroupMembershipSet).where(and(eq(accessGroupMembershipSet.membershipId,review.membershipId),eq(accessGroupMembershipSet.generation,review.generation))).for("update");
  if (!set) throw new AccessUnavailable();
  await tx.select().from(accessImpactFence).where(and(eq(accessImpactFence.kind,"membership"),eq(accessImpactFence.key,review.membershipId))).for("update");
 }
 await authority(tx,context,input.scopeId,"access.group.read",["groups",input.groupId]);
 const rows = await tx.select({ payload: accessGroupImpactEffect.payload }).from(accessGroupImpactEffect).where(eq(accessGroupImpactEffect.reviewId,review.id)).orderBy(accessGroupImpactEffect.ordinal).limit(4097);
 if (rows.length > 4096) throw new AccessUnavailable();
 const effects = rows.map(row => GroupImpactEffectSchema.parse(row.payload));
 const roots = await recoveryRoots(tx,review,effects);
 const fences = await tx.select().from(accessRoleBindingScope).where(inArray(accessRoleBindingScope.scopeId,roots)).orderBy(accessRoleBindingScope.scopeId).for("update");
 if (fences.length !== roots.length) throw new AccessUnavailable();
 const [tree] = await tx.select().from(accessGroupTree).where(eq(accessGroupTree.scopeId,review.scopeId)).for("update");
 if (!tree) throw new AccessUnavailable();
 // Ancestors whose derived height changes also write Group witnesses.
 const groupFences = (await tx.execute<{ id: string }>(sql`select g.id from public.access_group g
  join public.access_group_impact_witness w on w.kind='group' and w.key=g.id
  where w.review_id=${review.id}::uuid order by g.id for update of g`)).rows;
 if (groupFences.length > 4096) throw new AccessUnavailable();
 const impacted = (await tx.execute<{ key: string }>(sql`select f.key from public.access_impact_fence f
  join public.access_group_impact_witness w on w.kind=f.kind and w.key=f.key
  where w.review_id=${review.id}::uuid and (f.kind in ('group','tree') or (f.kind='membership' and f.key=${review.membershipId}::uuid)) order by f.kind,f.key for update of f`)).rows;
 if (impacted.length > 8193) throw new AccessUnavailable();
 return review;
}

async function reviewAuthorities(tx: DatabaseTransaction, context: PrincipalRequestContext, review: GroupImpactReview, evidence: Evidence) {
 const reader = await authority(tx,context,review.scopeId,"access.group.read",["groups",review.groupId]);
 const manager = await authority(tx,context,review.scopeId,groupImpactPermission(review.operation),["groups",review.groupId]);
 const confer = await readGroupImpactConferAuthority(tx,context,evidence.effects);
 return [reader,manager,...confer];
}

/** Read bounded physical candidates before current-admission filtering or subject deduplication. */
async function independentSubtreeRoster(tx: DatabaseTransaction, review: GroupImpactReview) {
 if (review.membershipId) {
  const [member] = await tx.select().from(accessMembership).where(eq(accessMembership.id,review.membershipId)).for("share");
  if (!member) throw new AccessUnavailable();
  return [member.subjectId];
 }
 await revalidateGroupImpactDiscovery(tx,review);
 if (review.status !== "complete") throw new AccessUnavailable();
 const groups = await tx.select({ groupId: accessGroupImpactNode.key }).from(accessGroupImpactNode)
  .where(and(eq(accessGroupImpactNode.reviewId,review.id),eq(accessGroupImpactNode.kind,"subtree")))
  .orderBy(accessGroupImpactNode.key).limit(4097);
 if (!groups.length || groups.length>4096) throw new AccessUnavailable();
 const candidates: { membershipId: string; generation: number }[] = [];
 for (const group of groups) {
  // The partial roster index is (group_id,membership_id,generation) WHERE selected.
  // LIMIT applies to this single index range, before any join/filter/dedup. Across
  // all Groups read at most 256 candidates plus one exhaustion sentinel, including
  // stale generations and multiple selections belonging to the same subject.
  const rows = await tx.select({ membershipId: accessGroupMembership.membershipId,generation: accessGroupMembership.generation,
   scopeId: accessGroupMembership.scopeId }).from(accessGroupMembership)
   .where(and(eq(accessGroupMembership.groupId,group.groupId),sql`${accessGroupMembership.selected}`))
   .orderBy(accessGroupMembership.membershipId,accessGroupMembership.generation).limit(257-candidates.length);
  if (candidates.length+rows.length>256) throw new AccessUnavailable();
  if (rows.some(row => row.scopeId!==review.scopeId)) throw new AccessUnavailable();
  candidates.push(...rows);
 }
 // Only now may duplicate membership identities be collapsed for bounded PK reads.
 const membershipIds = [...new Set(candidates.map(row => row.membershipId))].sort();
 const memberships = membershipIds.length ? await tx.select().from(accessMembership)
  .where(inArray(accessMembership.id,membershipIds)).orderBy(accessMembership.id).for("share") : [];
 if (memberships.length!==membershipIds.length || memberships.some(row => row.scopeId!==review.scopeId)) throw new AccessUnavailable();
 const byId = new Map(memberships.map(row => [row.id,row]));
 await revalidateGroupImpactDiscovery(tx,review);
 if (review.status !== "complete") throw new AccessUnavailable();
 return candidates.flatMap(candidate => {
  const member = byId.get(candidate.membershipId)!;
  return member.activeGeneration===candidate.generation ? [member.subjectId] : [];
 });
}

/** Conservative private accountability closure: potentially controlling a changed Entity is affectedness. */
async function independent(tx: DatabaseTransaction, review: GroupImpactReview, effects: GroupImpactEffect[], actor: Authority) {
 if (actor.principalId === review.operatorAuthUserId || actor.subjectId === review.authoritySubjectId) throw new AccessDenied();
 const roster = await independentSubtreeRoster(tx,review);
 return requireIndependentAccessOperator(tx,{
  principalId: review.operatorAuthUserId,subjectId: review.authoritySubjectId,
  affectedSubjectIds: [...roster,...effects.flatMap(effect => [effect.subjectId,...effect.dependencySubjectIds])],
  affectedEntityIds: effects.flatMap(effect => effect.entityId ? [effect.entityId] : []),
 },actor);
}

/** Private principal/controller closure shared by exact native mutation approvals. @internal */
export async function requireIndependentAccessOperator(tx: DatabaseTransaction, input: {
 principalId: string; subjectId: string; affectedSubjectIds: string[]; affectedEntityIds: string[];
}, actor: Authority) {
 if (actor.principalId === input.principalId || actor.subjectId === input.subjectId) throw new AccessDenied();
 const affected = new Set(input.affectedSubjectIds), entityIds = new Set(input.affectedEntityIds);
 if (affected.size > 256 || entityIds.size > 256) throw new AccessUnavailable();
 const subjects = affected.size ? await tx.select().from(accessSubject).where(inArray(accessSubject.id,[...affected])).limit(257) : [];
 if (subjects.length !== affected.size) throw new AccessUnavailable();
 if (affected.has(actor.subjectId) || subjects.some(subject => subject.authUserId === actor.principalId)) throw new AccessDenied();
 for (const subject of subjects) if (subject.entityId) entityIds.add(subject.entityId);
 const visited = new Set<string>();
 let work = 0;
 for (let depth = 0; entityIds.size; depth++) {
  if (depth >= 8 || visited.size + entityIds.size > 256) throw new AccessUnavailable();
  const batch = [...entityIds].filter(value => !visited.has(value)).sort(); entityIds.clear();
  for (const entityId of batch) {
   visited.add(entityId);
   // The negative Entity fence is required even when no grants currently exist.
   await tx.insert(accessRepresentationEntity).values({ entityId }).onConflictDoNothing();
   await tx.select().from(accessRepresentationEntity).where(eq(accessRepresentationEntity.entityId,entityId)).for("share");
   const grants = await tx.select().from(accessRepresentation).where(and(eq(accessRepresentation.entityId,entityId),eq(accessRepresentation.state,"active"))).orderBy(accessRepresentation.id).limit(257);
   work += grants.length;
   if (work > 256) throw new AccessUnavailable();
   for (const grant of grants) {
    // Over-approximate control deliberately, including dormant conditions. No false
    // independence can result from an unexamined target/action or a future clock.
    let recipients: (typeof accessSubject.$inferSelect)[];
    if (grant.recipientSubjectId) recipients = await tx.select().from(accessSubject).where(eq(accessSubject.id,grant.recipientSubjectId));
    else if (grant.recipientScopeId) {
     await tx.insert(accessImpactFence).values({ kind: "tree",key: grant.recipientScopeId }).onConflictDoNothing();
     await tx.select().from(accessImpactFence).where(and(eq(accessImpactFence.kind,"tree"),eq(accessImpactFence.key,grant.recipientScopeId))).for("share");
     await tx.select().from(accessGroupTree).where(eq(accessGroupTree.scopeId,grant.recipientScopeId)).for("share");
     // All active members are a conservative superset of a Group's controllers.
     const members = await tx.select({ subjectId: accessMembership.subjectId }).from(accessMembership)
      .where(and(eq(accessMembership.scopeId,grant.recipientScopeId),sql`${accessMembership.activeGeneration} is not null`)).orderBy(accessMembership.subjectId).limit(257);
     if (members.length > 256) throw new AccessUnavailable();
     recipients = members.length ? await tx.select().from(accessSubject).where(inArray(accessSubject.id,members.map(row => row.subjectId))) : [];
    } else throw new AccessUnavailable();
    work += recipients.length;
    if (work > 256) throw new AccessUnavailable();
    for (const recipient of recipients) {
     if (recipient.authUserId === actor.principalId || recipient.id === actor.subjectId) throw new AccessDenied();
     if (recipient.entityId && !visited.has(recipient.entityId)) entityIds.add(recipient.entityId);
    }
   }
  }
 }
}
function rejectChangedBasis(effects: GroupImpactEffect[], sources: Authority[]) {
 for (const source of sources) {
  if (effects.some(effect => (effect.sourceId === source.sourceBindingId && effect.subjectId === source.subjectId) ||
   source.representationPath.some(reference => reference.id === effect.sourceId))) throw new AccessDenied();
 }
}
function requireRecoveryPaths(effects: GroupImpactEffect[], sources: Authority[], review: GroupImpactReview) {
 const identity = (path: GroupImpactEffect["beforePaths"][number], after: boolean) => JSON.stringify({ ...path,
  selectionSetVersion: path.selectionSetVersion === null ? null : path.selectionSetVersion -
   (after && path.membershipId === review.membershipId && path.generation === review.generation ? 1 : 0) });
 for (const source of sources) for (const effect of effects) {
  if (!(effect.sourceId === source.sourceBindingId && effect.subjectId === source.subjectId) &&
   !source.representationPath.some(reference => reference.id === effect.sourceId)) continue;
  const allows = (permissions: GroupImpactEffect["before"]) => permissions.some(permission => permission.family === "management" && permission.key === source.permission);
  const surviving = new Set(effect.afterPaths.map(path => identity(path,true)));
  // Select a complete original enrollment/ancestry path, not a newly gained path
  // for the same binding. Redundant paths can change while this original one survives.
  if (!allows(effect.before) || !allows(effect.after) || !effect.beforePaths.some(path => surviving.has(identity(path,false)))) throw new AccessDenied();
 }
}
async function livePolicy(tx: DatabaseTransaction, effects: GroupImpactEffect[]) {
 const policy = await readGroupImpactCurrentPolicy(tx,effects);
 if (policy.outcome === "deny") throw new AccessDenied();
 if (policy.outcome !== "allow") throw new AccessUnavailable();
 return policy;
}
function deadline(review: GroupImpactReview, sources: Authority[], policyUntil: number | null = null) {
 return new Date(Math.min(review.validUntil.getTime(),policyUntil ?? Infinity,...sources.map(source => source.validUntil ?? Infinity)));
}

/** Privately inspect the exact transaction before independently acknowledging it. @internal */
export async function inspectGroupApproval(context: PrincipalRequestContext, input: ReviewKey) {
 return runAccessTransaction(async tx => {
  const review = await lockGroupAdmissionClosure(tx,context,input);
  const evidence = await readCompleteGroupApprovalEvidence(tx,review);
  const sources = await reviewAuthorities(tx,context,review,evidence);
  await independent(tx,review,evidence.effects,sources[1]!); rejectChangedBasis(evidence.effects,sources);
  const policy = await livePolicy(tx,evidence.effects);
  for (const source of sources) await requireAccessAdmission(tx,source.admission);
  let selection = null;
  if (review.membershipId) {
   const [member] = await tx.select().from(accessMembership).where(eq(accessMembership.id,review.membershipId)).for("share");
   if (!member || member.scopeId !== review.scopeId || review.generation === null || review.expectedSelectionVersion === null) throw new AccessUnavailable();
   const [policy] = await readAccessSubjectEligibility(tx,{ subjectIds: [member.subjectId],action: "read" });
   if (!policy || policy.outcome === "unavailable") throw new AccessUnavailable();
   selection = { ...presentGroupRecipient(context,review,member,policy.subject.kind,(await clock(tx)).getTime()),generation: review.generation,expectedVersion: review.expectedSelectionVersion };
  }
  for (const source of sources) await requireAccessAdmission(tx,source.admission);
  return { selection,reviewId: review.id, proposalDigest: proposalDigest(review),effectDigest: evidence.effectDigest,
   operation: review.operation,expectedGroupVersion: review.expectedGroupVersion,expectedTreeVersion: review.expectedTreeVersion,
   proposedParentId: review.proposedParentId, effectCount: evidence.effects.length, validUntil: deadline(review,sources,policy.validUntil).toISOString() };
 });
}

/** Record one fresh, currently authorized, independent principal's exact approval; retry never renews it. @internal */
export async function approveGroupImpact(context: PrincipalRequestContext, input: ReviewKey & { approvalId: string; proposalDigest: string; effectDigest: string }) {
 return runAccessTransaction(async tx => {
  const review = await lockGroupAdmissionClosure(tx,context,input);
  const original = await authority(tx,context,review.scopeId,groupImpactPermission(review.operation),["groups",review.groupId]);
  const [prior] = await tx.select().from(approvals).where(eq(approvals.id,input.approvalId)).for("update");
  if (prior) {
   if (prior.reviewId !== review.id || prior.principalId !== original.principalId || prior.subjectId !== original.subjectId ||
    prior.proposalDigest !== input.proposalDigest || prior.effectDigest !== input.effectDigest) throw new AccessChanged();
   await requireAccessAdmission(tx,original.admission);
   return { approvalId: prior.id,validUntil: prior.validUntil.toISOString(),revoked: prior.revokedAt !== null };
  }
  const evidence = await readCompleteGroupApprovalEvidence(tx,review);
  const sources = await reviewAuthorities(tx,context,review,evidence), actor = sources[1]!;
  await independent(tx,review,evidence.effects,actor); rejectChangedBasis(evidence.effects,sources);
  const proposal = proposalDigest(review);
  if (proposal !== input.proposalDigest || evidence.effectDigest !== input.effectDigest) throw new AccessChanged();
  const policy = await livePolicy(tx,evidence.effects);
  const sourceDigest = sourcesDigest(sources), witness = await witnessDigest(tx,review);
  const count = await tx.select({ id: approvals.id }).from(approvals).where(eq(approvals.reviewId,review.id)).limit(65);
  if (count.length >= 64) throw new AccessUnavailable();
  const [samePrincipal] = await tx.select({ id: approvals.id }).from(approvals).where(and(eq(approvals.reviewId,review.id),eq(approvals.principalId,actor.principalId)));
  if (samePrincipal) throw new AccessChanged();
  const validUntil = deadline(review,sources,policy.validUntil);
  if (await clock(tx) >= validUntil) throw new AccessDenied();
  for (const source of sources) await requireAccessAdmission(tx,source.admission);
  await tx.insert(approvals).values({ id: id.parse(input.approvalId),reviewId: review.id,principalId: actor.principalId,subjectId: actor.subjectId,
   proof: proofSchema.parse(context.credentialProof()),selection: context.selection,proposalDigest: proposal,effectDigest: evidence.effectDigest,
   sourceDigest,witnessDigest: witness,validUntil });
  return { approvalId: input.approvalId,validUntil: validUntil.toISOString(),revoked: false };
 });
}

/** Revocation uses the authenticated private principal, even if the old role or selected Entity was lost. @internal */
export async function revokeGroupApproval(context: PrincipalRequestContext, input: ReviewKey & { approvalId: string; operationId: string }) {
 return runAccessTransaction(async tx => {
  const credential = await readFirstPartyCredentialAuthority(tx,{ proof: context.credentialProof(),selection: context.selection,apiPermission: "access:manage",requireFreshSession: true,requireVerifiedEmail: true });
  const [review] = await tx.select().from(reviews).where(and(eq(reviews.id,input.reviewId),eq(reviews.scopeId,input.scopeId),eq(reviews.groupId,input.groupId))).for("update");
  if (!review) throw new AccessRecordUnavailable();
  const [row] = await tx.select().from(approvals).where(and(eq(approvals.id,input.approvalId),eq(approvals.reviewId,input.reviewId),eq(approvals.principalId,credential.principalId))).for("update");
  if (!row) throw new AccessRecordUnavailable();
  if (row.revokeOperationId && row.revokeOperationId !== input.operationId) throw new AccessChanged();
  await requireAccessAdmission(tx,credential.admission);
  if (!row.revokedAt) await tx.update(approvals).set({ revokedAt: await clock(tx),revokeOperationId: id.parse(input.operationId) }).where(eq(approvals.id,row.id));
  return { approvalId: row.id,validUntil: row.validUntil.toISOString(),revoked: true };
 });
}

/** Current native repair authority shared by Group and enrollment continuity. @internal */
export async function readNativeRecoveryAuthorities(tx: DatabaseTransaction, context: PrincipalRequestContext, scopeId: string) {
 const required = [...repairPermissions];
 const [scope] = (await tx.execute<{ entity: string | null }>(sql`select r.target_entity_id as entity from public.access_scope s
  left join public.reference_value r on r.id=s.unit_ref where s.id=${scopeId}::uuid`)).rows;
 if (!scope) throw new AccessUnavailable();
 if (scope.entity) required.push("access.representation.manage");
 const sources: Authority[] = [];
 for (const permission of required) sources.push(await authority(tx,context,scopeId,permission));
 return sources;
}

/** Register a currently exercisable, privately authenticated recovery route under fixed native-repair policy. @internal */
export async function registerRecoveryPath(context: PrincipalRequestContext, input: { scopeId: string; pathId: string }) {
 return runAccessTransaction(async tx => {
  await tx.insert(policies).values({ scopeId: input.scopeId }).onConflictDoNothing();
  const [policy] = await tx.select().from(policies).where(eq(policies.scopeId,input.scopeId)).for("update");
  if (!policy || policy.policy !== "native-repair-v1") throw new AccessUnavailable();
  const sources = await readNativeRecoveryAuthorities(tx,context,input.scopeId), actor = sources[0]!;
  const requestDigest = hash({ scopeId: input.scopeId,principalId: actor.principalId,subjectId: actor.subjectId,selection: context.selection });
  const [prior] = await tx.select().from(paths).where(eq(paths.id,input.pathId)).for("update");
  if (prior) {
   if (prior.requestDigest !== requestDigest) throw new AccessChanged();
   for (const source of sources) await requireAccessAdmission(tx,source.admission);
   return { pathId: prior.id,validUntil: prior.validUntil.toISOString(),revoked: prior.revokedAt !== null };
  }
  const now = await clock(tx);
  const current = await tx.select({ id: paths.id }).from(paths).where(and(eq(paths.scopeId,input.scopeId),isNull(paths.revokedAt),gt(paths.validUntil,now))).limit(9);
  if (current.length >= 8) throw new AccessUnavailable();
  const validUntil = new Date(Math.min(now.getTime()+900_000,...sources.map(source => source.validUntil ?? Infinity)));
  for (const source of sources) await requireAccessAdmission(tx,source.admission);
  if (await clock(tx) >= validUntil) throw new AccessDenied();
  await tx.insert(paths).values({ id: id.parse(input.pathId),scopeId: input.scopeId,principalId: actor.principalId,subjectId: actor.subjectId,
   proof: proofSchema.parse(context.credentialProof()),selection: context.selection,sourceDigest: sourcesDigest(sources),requestDigest,validUntil });
  return { pathId: input.pathId,validUntil: validUntil.toISOString(),revoked: false };
 });
}

/** Revoke one's own recovery evidence without retaining a lost represented identity as a prerequisite. @internal */
export async function revokeRecoveryPath(context: PrincipalRequestContext, input: { scopeId: string; pathId: string; operationId: string }) {
 return runAccessTransaction(async tx => {
  const credential = await readFirstPartyCredentialAuthority(tx,{ proof: context.credentialProof(),selection: context.selection,apiPermission: "access:manage",requireFreshSession: true,requireVerifiedEmail: true });
  await tx.select().from(policies).where(eq(policies.scopeId,input.scopeId)).for("update");
  const [row] = await tx.select().from(paths).where(and(eq(paths.id,input.pathId),eq(paths.scopeId,input.scopeId),eq(paths.principalId,credential.principalId))).for("update");
  if (!row) throw new AccessRecordUnavailable();
  if (row.revokeOperationId && row.revokeOperationId !== input.operationId) throw new AccessChanged();
  await requireAccessAdmission(tx,credential.admission);
  if (!row.revokedAt) await tx.update(paths).set({ revokedAt: await clock(tx),revokeOperationId: id.parse(input.operationId) }).where(eq(paths.id,row.id));
  return { pathId: row.id,validUntil: row.validUntil.toISOString(),revoked: true };
 });
}

async function validApprovals(tx: DatabaseTransaction, review: GroupImpactReview, evidence: Evidence, onlyOne = false) {
 const rows = await tx.select().from(approvals).where(eq(approvals.reviewId,review.id)).orderBy(approvals.id).limit(65).for("share");
 if (rows.length > 64) throw new AccessUnavailable();
 const witness = await witnessDigest(tx,review), now = await clock(tx);
 const valid: { row: typeof approvals.$inferSelect; sources: Authority[] }[] = [];
 let unavailable = false;
 for (const row of rows) {
  if (row.revokedAt || row.validUntil <= now || row.proposalDigest !== proposalDigest(review) || row.effectDigest !== evidence.effectDigest || row.witnessDigest !== witness) continue;
  try {
   const context = recoveryPathContext(row), sources = await reviewAuthorities(tx,context,review,evidence);
   if (sources[1]!.subjectId !== row.subjectId || sourcesDigest(sources) !== row.sourceDigest) continue;
   await independent(tx,review,evidence.effects,sources[1]!); rejectChangedBasis(evidence.effects,sources);
   for (const source of sources) await requireAccessAdmission(tx,source.admission);
   valid.push({ row,sources });
   if (onlyOne) break;
  } catch (error) {
   try { rethrowAccessFailure(error); }
   catch (failure) {
    if (failure instanceof AccessUnavailable || failure instanceof AccessRecordUnavailable) { unavailable = true; continue; }
    if (failure instanceof AccessDenied) continue;
    throw failure;
   }
  }
 }
 const finalTime = (await clock(tx)).getTime();
 return { valid: valid.filter(item => item.row.validUntil.getTime()>finalTime && item.sources.every(source => source.validUntil===null || source.validUntil>finalTime)),unavailable,rows };
}

/** Current private approval status omits principal, selected subject, credential and source identities. @internal */
export async function listGroupApprovals(context: PrincipalRequestContext, input: ReviewKey) {
 return runAccessTransaction(async tx => {
  const review = await lockGroupAdmissionClosure(tx,context,input);
  const reader = await authority(tx,context,review.scopeId,"access.group.read",["groups",review.groupId]);
  if (reader.principalId !== review.operatorAuthUserId || reader.subjectId !== review.authoritySubjectId) throw new AccessRecordUnavailable();
  const evidence = await readCompleteGroupApprovalEvidence(tx,review);
  const result = await validApprovals(tx,review,evidence), current = new Set(result.valid.map(item => item.row.id));
  await requireAccessAdmission(tx,reader.admission);
  return { reviewId: review.id, validApprovals: current.size, outcome: current.size ? "allow" as const : result.unavailable ? "unavailable" as const : "deny" as const,
   items: result.rows.map(row => ({ approvalId: row.id,validUntil: row.validUntil.toISOString(),revoked: row.revokedAt !== null,valid: current.has(row.id) })) };
 });
}

/** Select up to one unchanged, fully native pre-change repair path per affected root. */
async function selectRecovery(tx: DatabaseTransaction, review: GroupImpactReview, effects: GroupImpactEffect[]) {
 const selected: { row: typeof paths.$inferSelect; sources: Authority[] }[] = [];
 for (const scopeId of await recoveryRoots(tx,review,effects)) {
  const [policy] = await tx.select().from(policies).where(eq(policies.scopeId,scopeId)).for("share");
  if (!policy || policy.policy !== "native-repair-v1") throw new AccessUnavailable();
  const now = await clock(tx);
  const rows = await tx.select().from(paths).where(and(eq(paths.scopeId,scopeId),isNull(paths.revokedAt),gt(paths.validUntil,now),
   sql`pg_visible_in_snapshot(${paths.createdXid}::xid8,${review.baseSnapshot}::pg_snapshot)`))
   .orderBy(paths.id).limit(9).for("share");
  if (rows.length > 8) throw new AccessUnavailable();
  let found = false, unavailable = false;
  for (const row of rows) {
   // A newly established route cannot retrospectively become this review's old-state proof.
   if (row.createdAt > review.createdAt) continue;
   try {
    const sources = await readNativeRecoveryAuthorities(tx,recoveryPathContext(row),scopeId);
    if (sources[0]!.subjectId !== row.subjectId || sourcesDigest(sources) !== row.sourceDigest) continue;
    requireRecoveryPaths(effects,sources,review);
    for (const source of sources) await requireAccessAdmission(tx,source.admission);
    selected.push({ row,sources }); found = true; break;
   } catch (error) {
    try { rethrowAccessFailure(error); }
    catch (failure) {
     if (failure instanceof AccessUnavailable || failure instanceof AccessRecordUnavailable) { unavailable = true; continue; }
     if (failure instanceof AccessDenied) continue;
     throw failure;
    }
   }
  }
  if (!found) { if (unavailable) throw new AccessUnavailable(); throw new AccessDenied(); }
 }
 return selected;
}

/**
 * Consume full exact production admission and retain an after-state recovery check.
 * @internal
 * @remarks Call after lockGroupAdmissionClosure and current original-manager authority.
 * The primitive calls afterEffect inside its savepoint; failed continuity rolls back
 * the head, tree, height propagation and both receipts together. A current native
 * proof is selected even when its sources never appeared in the changed-source delta.
 */
export async function prepareGroupAdmission(tx: DatabaseTransaction, context: PrincipalRequestContext, review: GroupImpactReview, manager: Authority,
 input: { operationId: string; operation: GroupImpactReview["operation"]; expectedVersion: number; parentId: string | null; membershipId?: string; generation?: number; expectedSelectionVersion?: number }) {
 if (manager.principalId !== review.operatorAuthUserId || manager.subjectId !== review.authoritySubjectId || input.operation !== review.operation ||
  input.expectedVersion !== review.expectedGroupVersion || input.parentId !== review.proposedParentId ||
  (input.membershipId ?? null) !== review.membershipId || (input.generation ?? null) !== review.generation || (input.expectedSelectionVersion ?? null) !== review.expectedSelectionVersion) throw new AccessChanged();
 const [alreadyUsed] = await tx.select({ id: receipts.operationId }).from(receipts).where(eq(receipts.operationId,input.operationId));
 if (alreadyUsed) throw new AccessChanged();
 const evaluated = await lockCompleteGroupImpactEvaluation(tx,context,review,manager);
 const evidence: Evidence = { effectDigest: evaluated.effectDigest,effects: evaluated.effects };
 if (evaluated.policy.outcome === "deny") throw new AccessDenied();
 if (evaluated.policy.outcome !== "allow") throw new AccessUnavailable();
 const approval = await validApprovals(tx,review,evidence,true);
 if (!approval.valid.length) { if (approval.unavailable) throw new AccessUnavailable(); throw new AccessDenied(); }
 // One independent operator must authorize the complete proposal. Incomplete approvals
 // from several personas/scopes are never stitched together.
 const accepted = approval.valid[0]!;
 const recovery = await selectRecovery(tx,review,evidence.effects);
 await revalidateGroupImpactDiscovery(tx,review);
 if (review.status !== "complete") throw new AccessUnavailable();
 const retainedSources = [manager,...evaluated.sources,...accepted.sources,...recovery.flatMap(path => path.sources)];
 const validUntil = new Date(Math.min(evaluated.validUntil.getTime(),accepted.row.validUntil.getTime(),...recovery.map(path => path.row.validUntil.getTime()),
  ...retainedSources.map(source => source.validUntil ?? Infinity)));
 const deadlineSql = sql<boolean>`clock_timestamp()<${validUntil}::timestamptz`;
 const approvalSql = sql<boolean>`exists(select 1 from public.access_group_approval where id=${accepted.row.id}::uuid and revoked_at is null and valid_until>clock_timestamp())`;
 const reviewSql = sql<boolean>`exists(select 1 from public.access_group_impact_review where id=${review.id}::uuid and status='complete' and valid_until>clock_timestamp())
  and not exists(select 1 from public.access_group_impact_witness w left join public.access_impact_fence f on f.kind=w.kind and f.key=w.key
   where w.review_id=${review.id}::uuid and (f.version is null or f.version<>w.version))
  and exists(select 1 from public.access_group_tree where scope_id=${review.scopeId}::uuid and version=${review.expectedTreeVersion})`;
 const admission: SQL<boolean | null> = sql`(${deadlineSql}) and (${approvalSql}) and (${reviewSql}) and ${sql.join(retainedSources.map(source => sql`(${source.admission})`),sql` and `)}`;
 await requireAccessAdmission(tx,admission);
 return { admission, afterEffect: async (work: DatabaseTransaction) => {
  // Native evaluation in the actual proposed topology, not a source-delta ACL union.
  const after: Authority[] = [];
  for (const path of recovery) {
   const sources = await readNativeRecoveryAuthorities(work,recoveryPathContext(path.row),path.row.scopeId);
   if (continuityDigest(sources,review,true) !== continuityDigest(path.sources,review)) throw new AccessDenied();
   after.push(...sources);
  }
  const currentPolicy = await livePolicy(work,evidence.effects);
  await work.insert(receipts).values({ operationId: input.operationId,groupId: review.groupId,reviewId: review.id,membershipId: review.membershipId,generation: review.generation,
   proposalDigest: proposalDigest(review),effectDigest: evidence.effectDigest,approvalIds: [accepted.row.id],recoveryPathIds: recovery.map(path => path.row.id) });
  // No further row-locking work after this final clock/credential/recovery check.
  await requireAccessAdmission(work,sql`(${deadlineSql}) and (${approvalSql})
   and (${currentPolicy.validUntil === null ? sql`true` : sql`clock_timestamp()<${new Date(currentPolicy.validUntil)}::timestamptz`})
   and ${sql.join(retainedSources.map(source => sql`(${source.credential.admission})`),sql` and `)}
   and ${sql.join(after.map(source => sql`(${source.admission})`),sql` and `)}`);
 } };
}
