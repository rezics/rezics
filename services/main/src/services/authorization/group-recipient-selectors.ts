import { createHash, createHmac } from "node:crypto";
import type { PrincipalRequestContext } from "../auth/principal-session";
import { env } from "../config";
import type { accessMembership } from "@rezics/schema/postgres/access/access-membership";
import { createPrivateRecipientSelectors, type PrivateRecipientContext } from "./recipient-selectors";
type Key = { scopeId: string; groupId: string };
/** Group-purpose private selector codec; minting still requires current disclosure admission. @internal */
export const groupRecipients = createPrivateRecipientSelectors(Buffer.from(env.BETTER_AUTH_SECRET));
/** Credential, authority selection, scope and exact Group binding. @internal */
export function groupRecipientContext(context: PrincipalRequestContext, key: Key): PrivateRecipientContext {
 const selection = context.selection.mode === "represented" ? { ...context.selection,
  representations: [...context.selection.representations].sort((a,b) => a.id.localeCompare(b.id) || a.revision-b.revision) } : context.selection;
 return { principalId: context.principalId, selection, scopeId: key.scopeId, purpose: "group-membership",
  audience: createHash("sha256").update(JSON.stringify([context.credentialProof(), key.groupId])).digest("hex") };
}
/** Authorized private scope-local presentation without account/Profile association. @internal */
export function presentGroupRecipient(context: PrincipalRequestContext, key: Key, member: typeof accessMembership.$inferSelect, kind: "principal" | "entity", time: number) {
 const bound = groupRecipientContext(context,key);
 return { recipient: groupRecipients.mint(member.subjectId,bound,time),
  recipientKey: createHmac("sha256",env.BETTER_AUTH_SECRET).update(JSON.stringify(["group-member-presentation",bound,member.id])).digest("hex"),
  kind, membershipVersion: member.version, activeGeneration: member.activeGeneration, expiresAt: new Date(time+300_000).toISOString() };
}
