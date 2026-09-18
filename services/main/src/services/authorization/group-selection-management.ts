import { and, eq, gt, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import type { PrincipalRequestContext } from "../auth/principal-session";
import type { DatabaseTransaction } from "../database";
import { env } from "../config";
import { accessGroup, accessGroupTree } from "@rezics/schema/postgres/access/access-group";
import { accessMembership } from "@rezics/schema/postgres/access/access-membership";
import { accessGroupMembership, accessGroupMembershipSet, accessGroupMembershipEvent } from "@rezics/schema/postgres/access/access-group-membership";
import { accessGroupAdmissionReceipt } from "@rezics/schema/postgres/access/access-group-admission";
import { groupRecipients, groupRecipientContext, presentGroupRecipient } from "./group-recipient-selectors";
import { encryptOpaqueValue, decryptOpaqueValue } from "./opaque-values";
import { groupAuthority } from "./group-management";
import { lockGroupImpactReview, beginGroupImpactDiscovery, groupImpactSummary } from "./group-impact-discovery";
import { lockGroupAdmissionClosure, prepareGroupAdmission } from "./group-admission";
import { applyAccessGroupMembershipCommand } from "./group-memberships";
import { readAccessSubjectEligibility } from "./subject-eligibility";
import { requireAccessAdmission, runAccessTransaction } from "./transaction";
import { AccessChanged, AccessDenied, AccessInputInvalid, AccessRecordUnavailable, AccessUnavailable } from "./http-errors";

const id = z.uuid().toLowerCase(), version = z.number().int().safe().nonnegative();
const recipient = z.string().startsWith("rzr1.").max(512);
/** Exact direct selection operation; the private recipient is resolved by the server. @alpha */
export const GroupSelectionCommandSchema = z.strictObject({ recipient, generation: version.min(1), expectedVersion: version.max(Number.MAX_SAFE_INTEGER - 1),
 operationId: id, operation: z.enum(["assign", "remove", "prune"]), reviewId: id });
/** Selection-impact proposal reuses the ordinary private discovery/evaluation/approval lifecycle. @alpha */
export const GroupSelectionReviewSchema = GroupSelectionCommandSchema.omit({ operationId: true }).extend({ expectedGroupVersion: version.min(1), expectedTreeVersion: version });
const cursorSettings = { secret: env.BETTER_AUTH_SECRET, keyContext: "rezics:group-roster-cursor:v1", prefix: "rzgr1.", maximumLength: 4096 };
const frameSchema = z.strictObject({ groupId: id, groupVersion: version.min(1), afterChild: id.nullable(),
 afterMember: id.nullable(), afterGeneration: version, selectionsDone: z.boolean() });
const cursorSchema = z.strictObject({ treeVersion: version, expiresAt: version, afterSubject: id.nullable(), stack: z.array(frameSchema).max(8) });
type Cursor = z.infer<typeof cursorSchema>;
type Frame = z.infer<typeof frameSchema>;
type Key = { scopeId: string; groupId: string };
function cursorContext(context: PrincipalRequestContext, key: Key, view: string, stale: boolean) {
 const bound = groupRecipientContext(context,key);
 return Buffer.from(JSON.stringify([bound,view,stale]));
}
async function now(tx: DatabaseTransaction) {
 const value = (await tx.execute<{ now: string }>(sql`select clock_timestamp()::text as now`)).rows[0]?.now;
 const result = new Date(value ?? "invalid").getTime();
 if (!Number.isSafeInteger(result)) throw new AccessUnavailable();
 return result;
}
async function selectedMember(tx: DatabaseTransaction, context: PrincipalRequestContext, key: Key, token: string) {
 const subjectId = groupRecipients.resolve(token,groupRecipientContext(context,key),await now(tx));
 await tx.execute(sql`select public.lock_access_membership_key(${key.scopeId}::uuid,${subjectId}::uuid,false)`);
 const [member] = await tx.select().from(accessMembership).where(and(eq(accessMembership.scopeId,key.scopeId),eq(accessMembership.subjectId,subjectId))).for("share");
 if (!member) throw new AccessRecordUnavailable();
 return member;
}
async function subjectAdmission(tx: DatabaseTransaction, subjectId: string, assigning: boolean): Promise<SQL<boolean | null>> {
 const [policy] = await readAccessSubjectEligibility(tx,{ subjectIds: [subjectId],action: assigning ? "write" : "read" });
 if (!policy || policy.outcome === "unavailable") throw new AccessUnavailable();
 // Revocation/terminal cleanup remains possible for a closed or suspended member;
 // the known denial is retained, and never used to justify assignment.
 if (assigning && policy.outcome !== "allow") throw new AccessDenied();
 return sql`exists(select 1 from public.access_subject where id=${subjectId}::uuid)
  ${policy.validUntil === undefined ? sql`` : sql`and clock_timestamp()<${new Date(policy.validUntil)}::timestamptz`}`;
}


/** Start exact selection discovery only for an existing admitted generation and current manager. @internal */
export async function startGroupSelectionReview(context: PrincipalRequestContext, key: Key, input: z.infer<typeof GroupSelectionReviewSchema>) {
 return runAccessTransaction(async tx => {
  const authority = await groupAuthority(tx,context,key.scopeId,key.groupId,input.operation);
  const member = await selectedMember(tx,context,key,input.recipient);
  const eligibility = await subjectAdmission(tx,member.subjectId,input.operation === "assign");
  const review = await beginGroupImpactDiscovery(tx,{ ...key, reviewId: input.reviewId,operation: input.operation,
   membershipId: member.id,generation: input.generation,expectedSelectionVersion: input.expectedVersion,
   expectedGroupVersion: input.expectedGroupVersion,expectedTreeVersion: input.expectedTreeVersion,proposedParentId: null,
   principalId: authority.principalId,subjectId: authority.subjectId,
   reviewerSources: { bindingId: authority.sourceBindingId,representationIds: authority.representationPath.map(value => value.id),validUntil: authority.validUntil } });
  await requireAccessAdmission(tx,sql`(${authority.admission}) and (${eligibility})`);
  return groupImpactSummary(review);
 });
}

/** Consume full ceiling/independent/recovery admission for one exact direct selection; retries return the original receipt. @internal */
export async function writeGroupSelection(context: PrincipalRequestContext, key: Key, input: z.infer<typeof GroupSelectionCommandSchema>) {
 return runAccessTransaction(async tx => {
  // Promote before authority readers can acquire a shared tree/set witness. The
  // closure also promotes the target membership witness before its trigger writes.
  const [receipt] = await tx.select().from(accessGroupAdmissionReceipt).where(eq(accessGroupAdmissionReceipt.operationId,input.operationId));
  const review = receipt ? null : await lockGroupAdmissionClosure(tx,context,{ ...key,reviewId: input.reviewId });
  const authority = await groupAuthority(tx,context,key.scopeId,key.groupId,input.operation);
  const member = await selectedMember(tx,context,key,input.recipient);
  const eligibility = await subjectAdmission(tx,member.subjectId,input.operation === "assign");
  const [prior] = await tx.select().from(accessGroupMembershipEvent).where(and(eq(accessGroupMembershipEvent.membershipId,member.id),
   eq(accessGroupMembershipEvent.generation,input.generation),eq(accessGroupMembershipEvent.groupId,key.groupId),eq(accessGroupMembershipEvent.operationId,input.operationId)));
  if (Boolean(prior) !== Boolean(receipt)) throw new AccessChanged();
  if (prior && (!receipt || receipt.groupId !== key.groupId || receipt.reviewId !== input.reviewId)) throw new AccessChanged();
  let prepared: Awaited<ReturnType<typeof prepareGroupAdmission>> | null = null;
  if (!prior) {
   if (!review) throw new AccessChanged();
   prepared = await prepareGroupAdmission(tx,context,review,authority,{ operationId: input.operationId,operation: input.operation,
    expectedVersion: review.expectedGroupVersion,parentId: null,membershipId: member.id,generation: input.generation,expectedSelectionVersion: input.expectedVersion });
  }
  const admission = sql<boolean | null>`(${authority.admission}) and (${eligibility}) ${prepared ? sql`and (${prepared.admission})` : sql``}`;
  const afterEffect = prepared?.afterEffect;
  const result = await applyAccessGroupMembershipCommand(tx,{ ...key,membershipId: member.id,generation: input.generation,
   expectedVersion: input.expectedVersion,operationId: input.operationId,operation: input.operation,
   operatorAuthUserId: authority.principalId,authoritySubjectId: authority.subjectId },admission,afterEffect ? async work => {
   await afterEffect(work);
   await requireAccessAdmission(work,eligibility);
  } : undefined);
  return { groupId: result.groupId,generation: result.generation,version: result.version,operationId: result.operationId,selectedAfter: result.selectedAfter };
 });
}

/** Exact selection state, including an absent version-zero slot, without exposing private subject/enrollment ids. @internal */
export async function getGroupSelection(context: PrincipalRequestContext, key: Key, input: { recipient: string; generation: number }) {
 return runAccessTransaction(async tx => {
  const authority = await groupAuthority(tx,context,key.scopeId,key.groupId,"read");
  const member = await selectedMember(tx,context,key,input.recipient);
  const [set] = await tx.select().from(accessGroupMembershipSet).where(and(eq(accessGroupMembershipSet.membershipId,member.id),eq(accessGroupMembershipSet.generation,input.generation))).for("share");
  if (!set) throw new AccessRecordUnavailable();
  const [head] = await tx.select().from(accessGroupMembership).where(and(eq(accessGroupMembership.membershipId,member.id),eq(accessGroupMembership.generation,input.generation),eq(accessGroupMembership.groupId,key.groupId)));
  const [group] = await tx.select().from(accessGroup).where(and(eq(accessGroup.id,key.groupId),eq(accessGroup.scopeId,key.scopeId)));
  if (!group) throw new AccessRecordUnavailable();
  const eligibility = await subjectAdmission(tx,member.subjectId,false);
  await requireAccessAdmission(tx,sql`(${authority.admission}) and (${eligibility})`);
  return { groupId: key.groupId,generation: input.generation,version: head?.version ?? 0,selected: head?.selected ?? false,
   setVersion: set.version,activeGeneration: member.activeGeneration,terminallyStale: member.activeGeneration !== input.generation || group.state === "retired" };
 });
}

/**
 * Private live keyset pages over admitted scope candidates or direct/inherited selections.
 * @internal
 * @remarks Each page reads at most 100 physical selections/memberships and 100
 * child keys before hydration/filtering. DFS cursor frames retain each parent
 * keyset (at most eight levels); no recursive subtree scan, join or dedup precedes
 * these limits. Empty pages may have continuation. Topology changes invalidate a
 * cursor; concurrent enrollment/selection changes use ordinary live keyset semantics.
 * Each direct selection is a separate row even if the subject also inherits the
 * requested Group through another selection. Stale physical slots are visible only
 * in explicit direct maintenance view; all-members remains derived enrollment.
 */
export async function listGroupRoster(context: PrincipalRequestContext, key: Key,
 input: { view: "admitted" | "direct" | "inherited"; includeStale?: boolean; cursor?: string }) {
 return runAccessTransaction(async tx => {
  const stale = input.includeStale ?? false;
  if (stale && input.view !== "direct") throw new AccessInputInvalid();
  const authority = await groupAuthority(tx,context,key.scopeId,key.groupId,"read",input.view === "admitted" || stale);
  // Candidate discovery and stale maintenance additionally require current member
  // management. Ordinary private Group read cannot enumerate the scope roster.
  const manager = input.view === "admitted" || stale ? await groupAuthority(tx,context,key.scopeId,key.groupId,"remove") : null;
  const [tree] = await tx.select().from(accessGroupTree).where(eq(accessGroupTree.scopeId,key.scopeId)).for("share");
  const [root] = await tx.select().from(accessGroup).where(and(eq(accessGroup.id,key.groupId),eq(accessGroup.scopeId,key.scopeId)));
  if (!tree || !root) throw new AccessRecordUnavailable();
  if (root.state !== "active" && root.state !== "retired") throw new AccessUnavailable();
  const time = await now(tx), aad = cursorContext(context,key,input.view,stale);
  const frame = (groupId: string, groupVersion: number): Frame => ({ groupId,groupVersion,afterChild: null,afterMember: null,afterGeneration: 0,selectionsDone: false });
  let cursor: Cursor = { treeVersion: tree.version,expiresAt: time+300_000,afterSubject: null,stack: [frame(root.id,root.version)] };
  if (input.cursor) {
   try { cursor = cursorSchema.parse(JSON.parse(decryptOpaqueValue(input.cursor,aad,cursorSettings).toString("utf8"))); }
   catch { throw new AccessInputInvalid(); }
   if (cursor.expiresAt <= time || cursor.expiresAt > time+300_000) throw new AccessInputInvalid();
   if (cursor.treeVersion !== tree.version) throw new AccessChanged();
  }
  const candidates: { member: typeof accessMembership.$inferSelect; generation: number; selectionVersion: number | null; setVersion: number | null; path: { groupId: string; version: number }[]; terminallyStale: boolean }[] = [];
  let more = false;
  if (input.view === "admitted") {
   const rows = await tx.select().from(accessMembership).where(and(eq(accessMembership.scopeId,key.scopeId),sql`${accessMembership.activeGeneration} is not null`,
    cursor.afterSubject ? gt(accessMembership.subjectId,cursor.afterSubject) : undefined)).orderBy(accessMembership.subjectId).limit(101).for("share");
   for (const member of rows.slice(0,100)) candidates.push({ member,generation: member.activeGeneration!,selectionVersion: null,setVersion: null,path: [],terminallyStale: false });
   cursor.afterSubject = rows.slice(0,100).at(-1)?.subjectId ?? cursor.afterSubject; more = rows.length > 100;
  } else if (root.state === "active" || stale) {
   let visited = 0, physical = 0;
   while (cursor.stack.length && physical < 100 && visited < 100) {
    const current = cursor.stack.at(-1)!;
    if (!current.selectionsDone) {
     const allowance = 100-physical;
     const rows = await tx.select().from(accessGroupMembership).where(and(eq(accessGroupMembership.groupId,current.groupId),sql`${accessGroupMembership.selected}`,
      current.afterMember ? sql`row(${accessGroupMembership.membershipId},${accessGroupMembership.generation})>row(${current.afterMember}::uuid,${current.afterGeneration}::bigint)` : undefined))
      .orderBy(accessGroupMembership.membershipId,accessGroupMembership.generation).limit(allowance+1);
     for (const row of rows.slice(0,allowance)) {
      physical++; current.afterMember = row.membershipId; current.afterGeneration = row.generation;
      const [member] = await tx.select().from(accessMembership).where(eq(accessMembership.id,row.membershipId)).for("share");
      const [set] = await tx.select().from(accessGroupMembershipSet).where(and(eq(accessGroupMembershipSet.membershipId,row.membershipId),eq(accessGroupMembershipSet.generation,row.generation))).for("share");
      const [live] = await tx.select().from(accessGroupMembership).where(and(eq(accessGroupMembership.membershipId,row.membershipId),eq(accessGroupMembership.generation,row.generation),eq(accessGroupMembership.groupId,row.groupId)));
      if (!live || !live.selected || live.version !== row.version) throw new AccessChanged();
      if (!member || !set || member.scopeId !== key.scopeId || row.scopeId !== key.scopeId) throw new AccessUnavailable();
      const terminallyStale = member.activeGeneration !== row.generation || root.state === "retired";
      if (!terminallyStale || stale) candidates.push({ member,generation: row.generation,selectionVersion: row.version,setVersion: set.version,
       path: [...cursor.stack].reverse().map(value => ({ groupId: value.groupId,version: value.groupVersion })),terminallyStale });
     }
     current.selectionsDone = rows.length <= allowance;
     if (!current.selectionsDone) break;
    }
    if (input.view === "direct") { cursor.stack.pop(); break; }
    const [child] = await tx.select().from(accessGroup).where(and(eq(accessGroup.scopeId,key.scopeId),eq(accessGroup.parentId,current.groupId),eq(accessGroup.state,"active"),
     current.afterChild ? gt(accessGroup.id,current.afterChild) : undefined)).orderBy(accessGroup.id).limit(1);
    visited++;
    if (!child) { cursor.stack.pop(); continue; }
    if (cursor.stack.length >= 8 || cursor.stack.some(value => value.groupId === child.id)) throw new AccessUnavailable();
    current.afterChild = child.id; cursor.stack.push(frame(child.id,child.version));
   }
   more = cursor.stack.length > 0;
  }
  const policies = await readAccessSubjectEligibility(tx,{ subjectIds: [...new Set(candidates.map(row => row.member.subjectId))],action: "read" });
  if (policies.some(policy => policy.outcome === "unavailable")) throw new AccessUnavailable();
  const bySubject = new Map(policies.map(policy => [policy.subjectId,policy]));
  const finalTime = await now(tx);
  const items = candidates.flatMap(row => {
   const policy = bySubject.get(row.member.subjectId);
   if (!policy || (policy.validUntil !== undefined && policy.validUntil <= finalTime)) throw new AccessUnavailable();
   if (policy.outcome !== "allow" && !stale) return [];
   return [{ ...presentGroupRecipient(context,key,row.member,policy.subject.kind,finalTime),generation: row.generation,selectionVersion: row.selectionVersion,
    setVersion: row.setVersion,path: row.path,direct: row.path.length === 1,terminallyStale: row.terminallyStale,eligible: policy.outcome === "allow" }];
  });
  await requireAccessAdmission(tx,sql`(${authority.admission}) ${manager ? sql`and (${manager.admission})` : sql``}`);
  return { items,treeVersion: tree.version,nextCursor: more ? encryptOpaqueValue(Buffer.from(JSON.stringify(cursor)),aad,cursorSettings) : null };
 });
}

/** Refresh an original reviewer's Group-purpose selector after its five-minute expiry, including consumed/pruned history. @internal */
export async function getGroupReviewRecipient(context: PrincipalRequestContext, key: Key, reviewId: string) {
 return runAccessTransaction(async tx => {
  const reader = await groupAuthority(tx,context,key.scopeId,key.groupId,"read",true);
  const manager = await groupAuthority(tx,context,key.scopeId,key.groupId,"remove");
  const [receipt] = await tx.select().from(accessGroupAdmissionReceipt).where(eq(accessGroupAdmissionReceipt.reviewId,reviewId));
  let membershipId: string, generation: number;
  if (receipt) {
   if (!receipt.membershipId || receipt.generation === null || receipt.groupId !== key.groupId) throw new AccessRecordUnavailable();
   const [event] = await tx.select().from(accessGroupMembershipEvent).where(and(eq(accessGroupMembershipEvent.membershipId,receipt.membershipId),
    eq(accessGroupMembershipEvent.generation,receipt.generation),eq(accessGroupMembershipEvent.groupId,key.groupId),eq(accessGroupMembershipEvent.operationId,receipt.operationId)));
   if (!event || event.operatorAuthUserId !== reader.principalId || event.authoritySubjectId !== reader.subjectId) throw new AccessRecordUnavailable();
   membershipId = receipt.membershipId; generation = receipt.generation;
  } else {
   const review = await lockGroupImpactReview(tx,{ ...key,reviewId,principalId: reader.principalId,subjectId: reader.subjectId });
   if (!review.membershipId || review.generation === null) throw new AccessRecordUnavailable();
   membershipId = review.membershipId; generation = review.generation;
  }
  const [member] = await tx.select().from(accessMembership).where(eq(accessMembership.id,membershipId)).for("share");
  if (!member || member.scopeId !== key.scopeId) throw new AccessUnavailable();
  const [policy] = await readAccessSubjectEligibility(tx,{ subjectIds: [member.subjectId],action: "read" });
  if (!policy || policy.outcome === "unavailable") throw new AccessUnavailable();
  await requireAccessAdmission(tx,sql`(${reader.admission}) and (${manager.admission})`);
  return { ...presentGroupRecipient(context,key,member,policy.subject.kind,await now(tx)),generation };
 });
}
