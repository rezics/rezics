import { z } from "zod";
import { AccessManagementPermissionValues } from "@rezics/access";
import { UnitReferenceSchema } from "@rezics/reference";
import { AccessGroupPresentationSchema } from "../../authorization/groups";
import { AccessRoleDefinitionSchema } from "../../authorization/roles";

const id = z.uuid().toLowerCase();
const version = z.number().int().safe().min(0);
const positiveVersion = version.min(1);
const state = z.enum(["draft", "active", "retired"]);
const scope = z.string().startsWith("rzs1.").max(512);
/** Public management root requests never accept another account's private identifier. @alpha */
export const ResolveScopeBody = z.strictObject({
	target: z.discriminatedUnion("kind", [z.strictObject({ kind: z.literal("self-account") }),
		z.strictObject({ kind: z.literal("platform") }),
		z.strictObject({ kind: z.literal("resource"), reference: UnitReferenceSchema })]),
	permission: z.enum(AccessManagementPermissionValues),
	path: z.array(z.string().regex(/^[a-z0-9][a-z0-9-]{0,255}$/)).max(8),
});
/** Confidential, credential-bound locator; possession grants no access. @alpha */
export const ResolvedScope = z.strictObject({ scope, expiresAt: z.iso.datetime() });
/** Role directory root and selected role parameters. @alpha */
export const ScopeParams = z.strictObject({ scope });
/** Selected role inside the supplied root. @alpha */
export const RoleParams = ScopeParams.extend({ roleId: id });
/** Bounded role directory continuation. @alpha */
export const RoleListQuery = z.strictObject({ afterId: id.optional() });
/** Exact optional definition selection. @alpha */
export const RoleQuery = z.strictObject({ definitionRevision: z.coerce.number().int().positive().safe().optional() });
/** Bounded role control history continuation. @alpha */
export const RoleHistoryQuery = z.strictObject({ afterVersion: z.coerce.number().int().nonnegative().safe().optional() });
/** Stable command identity and optimistic precondition for definition creation. @alpha */
export const CreateRoleBody = z.strictObject({ operationId: id, expectedVersion: z.literal(0), definition: AccessRoleDefinitionSchema });
/** Complete next definition; changing it does not activate permissions. @alpha */
export const ReviseRoleBody = CreateRoleBody.extend({ expectedVersion: positiveVersion });
/** Stable command receipt without private issuer identity. @alpha */
export const RoleReceipt = z.strictObject({ roleId: id, operationId: id, version: positiveVersion,
	state, activeRevision: positiveVersion.nullable(), definitionRevision: positiveVersion.nullable() });
/** Role control head and selected immutable definition. @alpha */
export const ManagedRole = z.strictObject({ id, version: positiveVersion, state, activeRevision: positiveVersion.nullable(),
	definition: AccessRoleDefinitionSchema.extend({ revision: positiveVersion }) });
/** Keyset-paginated role directory. @alpha */
export const ManagedRoles = z.strictObject({ items: z.array(z.strictObject({ id, version: positiveVersion, state,
	activeRevision: positiveVersion.nullable(), definitionRevision: positiveVersion, label: z.string() })).max(100), nextCursor: id.nullable() });
/** Control events deliberately omit the private account and subject identifiers. @alpha */
export const ManagedRoleHistory = z.strictObject({ items: z.array(z.strictObject({ version: positiveVersion,
	operationId: id, operation: z.enum(["create", "revise", "activate", "retire"]), state,
	activeRevision: positiveVersion.nullable(), createdAt: z.iso.datetime() })).max(100), nextCursor: positiveVersion.nullable() });

/** Selected private Group at a credential-bound management root. @alpha */
export const GroupParams = ScopeParams.extend({ groupId: id });
/** Bounded Group directory continuation. @alpha */
export const GroupListQuery = z.strictObject({ afterId: id.optional() });
/** Exact historical version, omitted for the current head. @alpha */
export const GroupQuery = z.strictObject({ version: z.coerce.number().int().safe().min(1).optional() });
/** Bounded Group snapshot history continuation. @alpha */
export const GroupHistoryQuery = z.strictObject({ afterVersion: z.coerce.number().int().safe().min(0).optional() });
/** Create one Group with an explicit parent selection and retry identity. @alpha */
export const CreateGroupBody = z.strictObject({ operationId: id, expectedVersion: z.literal(0), parentId: id.nullable(), presentation: AccessGroupPresentationSchema });
/** Complete presentation replacement preserves topology and membership. @alpha */
export const UpdateGroupBody = z.strictObject({ operationId: id, expectedVersion: positiveVersion, presentation: AccessGroupPresentationSchema });
/** Move one Group; populated impact requires the exact approved review. @alpha */
export const ReparentGroupBody = z.strictObject({ operationId: id, expectedVersion: positiveVersion, parentId: id.nullable(), reviewId: id.optional() });
/** Retire one leaf Group with exact approved impact and protected recovery. @alpha */
export const RetireGroupBody = z.strictObject({ operationId: id, expectedVersion: positiveVersion, reviewId: id.optional() });
/** Original command outcome, never a continuing authority proof. @alpha */
export const GroupReceipt = z.strictObject({ groupId: id, operationId: id, version: positiveVersion, state: z.enum(["active", "retired"]), parentId: id.nullable() });
/** Private Group presentation snapshot without principal/subject attribution. @alpha */
export const ManagedGroup = AccessGroupPresentationSchema.extend({ groupId: id, version: positiveVersion, state: z.enum(["active", "retired"]), parentId: id.nullable() });
/** Scope/id keyset directory; current authority is rechecked on every page. @alpha */
export const ManagedGroups = z.strictObject({ items: z.array(ManagedGroup).max(100), nextCursor: id.nullable() });
/** Immutable presentation and command history, omitting private audit identities. @alpha */
export const ManagedGroupHistory = z.strictObject({ items: z.array(ManagedGroup.omit({ groupId: true }).extend({ operationId: id, operation: z.enum(["create", "update", "reparent", "retire"]), createdAt: z.iso.datetime() })).max(100), nextCursor: positiveVersion.nullable() });

/** Version-bound proposal to inspect; successful discovery grants no mutation authority. @alpha */
export { GroupImpactProposalSchema as StartGroupImpactBody } from "../../authorization/group-impact-discovery";
/** Current optimistic preconditions for the selected Group. @alpha */
export const GroupImpactContext = z.strictObject({ groupVersion: version, treeVersion: version, state });
/** Review identity remains private and confers no authority by possession. @alpha */
export const GroupImpactParams = GroupParams.extend({ reviewId: id });
/** Retry identity for one server-owned discovery page. @alpha */
export const AdvanceGroupImpactBody = z.strictObject({ expectedPageVersion: version.max(65536) });
/** Inspection is paginated independently from discovery execution. @alpha */
export const GroupImpactQuery = z.strictObject({ afterOrdinal: z.coerce.number().int().min(0).max(32768).optional() });
/** Completeness and validity are distinct from ceiling/recovery approval. @alpha */
export const GroupImpactSummary = z.strictObject({ reviewId: id, operation: z.enum(["reparent", "retire", "assign", "remove", "prune"]),
	expectedGroupVersion: positiveVersion, expectedTreeVersion: version, proposedParentId: id.nullable(),
	status: z.enum(["discovering", "complete", "invalidated", "unavailable"]), reason: z.enum(["changed", "expired", "budget", "missing"]).nullable(),
	pageVersion: version, discoveredItems: version, validUntil: z.iso.datetime(), admission: z.literal("not-evaluated") });
/** Facts use opaque review-local identifiers; private recipient mappings and external target ids are omitted. @alpha */
export const GroupImpactInspection = GroupImpactSummary.extend({ items: z.array(z.strictObject({ itemId: id,
	ordinal: positiveVersion, kind: z.string(), version: version.nullable(), termsRevision: version.nullable(), state: z.string().nullable() })).max(100),
	nextCursor: positiveVersion.nullable() });

/** Private evaluation progress never represents protected mutation admission. @alpha */
export const GroupImpactEvaluationSummary = z.strictObject({ reviewId: id,
	status: z.enum(["evaluating","complete","denied","unavailable","invalidated"]),reason: z.string().nullable(),
	pageVersion: version.max(4096),processedEffects: version.max(4096),totalEffects: version.max(4096),validUntil: z.iso.datetime(),
	delta: z.enum(["complete","unavailable"]),currentPolicy: z.enum(["allow","deny","unavailable"]),policyReason: z.string().nullable(),
	admission: z.literal("not-admitted") });
/** Counts and opaque ids disclose no private recipient, source, target or permission names. @alpha */
export const GroupImpactEvaluationInspection = GroupImpactEvaluationSummary.extend({ items: z.array(z.strictObject({
	itemId: id,ordinal: version.max(4096),kind: z.enum(["binding","representation","ceiling"]),beforePermissions: version,afterPermissions: version,
	beforePaths: version.max(64),afterPaths: version.max(64),confer: z.boolean(),decision: z.enum(["pending","not-required","covered","approval-required","denied","unavailable"]),reason: z.string().nullable(),
})).max(100),nextCursor: version.max(4096).nullable() });

/** Exact independent acknowledgement of a privately inspected Group transaction. @alpha */
export const ApproveGroupBody = z.strictObject({ approvalId: id,proposalDigest: z.string().regex(/^[0-9a-f]{64}$/),effectDigest: z.string().regex(/^[0-9a-f]{64}$/) });
/** Private review-local approval handle. @alpha */
export const GroupApprovalParams = GroupImpactParams.extend({ approvalId: id });
/** Revocation retry identity does not renew or replace its original evidence. @alpha */
export const RevokeEvidenceBody = z.strictObject({ operationId: id });
/** Purpose-bound recipient presentation has no private account or global subject identifier. @alpha */
export const GroupRecipient = z.strictObject({ recipient: z.string(),recipientKey: z.string(),kind: z.enum(["principal","entity"]),
 membershipVersion: version,activeGeneration: positiveVersion.nullable(),expiresAt: z.iso.datetime(),generation: positiveVersion });
/** Independent approvers see the exact proposed topology and complete-effect acknowledgement. @alpha */
export const GroupApprovalProposal = z.strictObject({ selection: GroupRecipient.extend({ expectedVersion: version }).nullable(),reviewId: id,proposalDigest: z.string(),effectDigest: z.string(),operation: z.enum(["reparent","retire","assign","remove","prune"]),
 expectedGroupVersion: positiveVersion,expectedTreeVersion: version,proposedParentId: id.nullable(),effectCount: version.max(4096),validUntil: z.iso.datetime() });
/** An immutable approval receipt remains historical after revocation or expiry. @alpha */
export const GroupApprovalReceipt = z.strictObject({ approvalId: id,validUntil: z.iso.datetime(),revoked: z.boolean() });
/** Only currently revalidated complete independent approvals count. @alpha */
export const GroupApprovalList = z.strictObject({ reviewId: id,validApprovals: version.max(64),outcome: z.enum(["allow","deny","unavailable"]),
 items: z.array(GroupApprovalReceipt.extend({ valid: z.boolean() })).max(64) });
/** Recovery evidence is supplied by the authenticated principal and authority selection. @alpha */
export const RegisterRecoveryBody = z.strictObject({ pathId: id });
/** Private recovery path handle inside one selected authority root. @alpha */
export const RecoveryPathParams = ScopeParams.extend({ pathId: id });
/** Register/revoke returns no private principal, subject or credential fields. @alpha */
export const RecoveryPathReceipt = z.strictObject({ pathId: id,validUntil: z.iso.datetime(),revoked: z.boolean() });

/** Private direct selection commands and impact proposals use purpose-bound recipients. @alpha */
export { GroupSelectionCommandSchema as GroupSelectionBody, GroupSelectionReviewSchema as StartGroupSelectionReviewBody } from "../../authorization/group-selection-management";
/** Select one admitted generation without placing its private selector in URL logs. @alpha */
export const GroupSelectionQueryBody = z.strictObject({ recipient: z.string().startsWith("rzr1.").max(512),generation: positiveVersion });
/** Original direct selection command outcome; not a current membership proof. @alpha */
export const GroupSelectionReceipt = z.strictObject({ groupId: id,generation: positiveVersion,version: positiveVersion,operationId: id,selectedAfter: z.boolean() });
/** Current physical selection and generation preconditions, independent of current eligibility. @alpha */
export const GroupSelectionState = z.strictObject({ groupId: id,generation: positiveVersion,version,selected: z.boolean(),setVersion: version,
 activeGeneration: positiveVersion.nullable(),terminallyStale: z.boolean() });
/** Current private roster view; admitted candidates and stale direct slots require membership management. @alpha */
export const GroupRosterQuery = z.strictObject({ view: z.enum(["admitted","direct","inherited"]).default("direct"),
 includeStale: z.enum(["true","false"]).transform(value => value === "true").optional(),cursor: z.string().startsWith("rzgr1.").max(4096).optional() });
/** Live keyset page preserves one row per direct path; empty pages can have a continuation. @alpha */
export const GroupRoster = z.strictObject({ treeVersion: version,nextCursor: z.string().nullable(),items: z.array(z.strictObject({
 recipient: z.string(),recipientKey: z.string(),kind: z.enum(["principal","entity"]),membershipVersion: version,
 activeGeneration: positiveVersion.nullable(),expiresAt: z.iso.datetime(),generation: positiveVersion,selectionVersion: positiveVersion.nullable(),
 setVersion: version.nullable(),path: z.array(z.strictObject({ groupId: id,version: positiveVersion })).max(8),direct: z.boolean(),terminallyStale: z.boolean(),eligible: z.boolean(),
})).max(100) });

/** Server-resolved exact Role/Binding/Ceiling proposal. @alpha */
export { AssignmentProposalSchema as AssignmentProposalBody,AssignmentAcknowledgementSchema as AssignmentAcknowledgement } from "../../authorization/assignment-management-contracts";
/** Private assignment recipient presentation. @alpha */
export const AssignmentSubject = z.strictObject({ kind: z.enum(["principal","entity"]),recipient: z.string(),recipientKey: z.string(),expiresAt: z.iso.datetime() });
/** Purpose-bound subject selection has no raw private principal alternative. @alpha */
const recipientManagement = { management: z.enum(["binding","ceiling"]).default("binding"),targetPath: z.array(z.string().regex(/^[a-z0-9][a-z0-9-]{0,255}$/)).max(8).default([]) };
export const SelectAssignmentRecipientBody = z.discriminatedUnion("kind",[z.strictObject({ ...recipientManagement,kind: z.literal("self") }),z.strictObject({ ...recipientManagement,kind: z.literal("entity"),entityId: id })]);
/** Choose a disclosed enrollment root and continue its exact epoch without private IDs in URLs. @alpha */
export const AssignmentRecipientsBody = z.strictObject({ ...recipientManagement,recipientScope: scope,cursor: z.string().startsWith("rzar1.").max(2048).optional() });
/** Complete physical enrollment pages retain eligibility separately from recipient identity. @alpha */
export const AssignmentRecipients = z.strictObject({ items: z.array(AssignmentSubject.extend({ membershipVersion: version,generation: positiveVersion.nullable(),eligible: z.boolean() })).max(100),treeVersion: version,membershipEpoch: version,nextCursor: z.string().nullable() });
/** Selected native binding. @alpha */
export const BindingParams = ScopeParams.extend({ bindingId: id });
/** Selected immutable confer approval. @alpha */
export const CeilingParams = ScopeParams.extend({ ceilingId: id });
/** Exact private review, distinct from a continuing authority proof. @alpha */
export const AssignmentReviewParams = ScopeParams.extend({ reviewId: id });
/** Review-local immutable independent acknowledgement. @alpha */
export const AssignmentApprovalParams = AssignmentReviewParams.extend({ approvalId: id });
/** Stable execution references bind the resource operation to its complete inspected effect. @alpha */
export const ExecuteAssignmentBody = z.strictObject({ reviewId: id,proposalDigest: z.string().regex(/^[0-9a-f]{64}$/),effectDigest: z.string().regex(/^[0-9a-f]{64}$/) });
/** Independent operator acknowledgement. @alpha */
export const ApproveAssignmentBody = ExecuteAssignmentBody.omit({ reviewId: true }).extend({ approvalId: id });
/** Bounded impact inspection offset in an immutable complete effect set. @alpha */
export const AssignmentImpactQuery = z.strictObject({ afterOrdinal: z.coerce.number().int().min(0).max(4096).optional() });
/** Complete captured review; current admission is re-established before execution. @alpha */
export const AssignmentReview = z.strictObject({ reviewId: id,proposalDigest: z.string(),effectDigest: z.string(),effectCount: version.max(4096),requiresApproval: z.boolean(),validUntil: z.iso.datetime(),status: z.literal("complete") });
/** Recipient projection includes only a scope-bound private handle or an explicit member set. @alpha */
export const ManagedAssignmentRecipient = z.discriminatedUnion("kind",[
 z.strictObject({ kind: z.literal("subject"),subject: AssignmentSubject }),z.strictObject({ kind: z.literal("group"),scope,groupId: id }),
 z.strictObject({ kind: z.literal("all-members"),scope }),z.strictObject({ kind: z.literal("scope-members"),scope,subjectKind: z.enum(["principal","entity"]) }),
]);
import { ManagedBindingTermsSchema } from "../../authorization/assignment-management-contracts";
import { AccessPermissionSchema } from "../../authorization/permission";
/** Stable binding command receipt. @alpha */
export const BindingReceipt = z.strictObject({ bindingId: id,operationId: id,version: positiveVersion,termsRevision: positiveVersion,state: z.enum(["active","revoked"]) });
/** Stable institutional ceiling command receipt. @alpha */
export const CeilingReceipt = z.strictObject({ ceilingId: id,operationId: id,version: positiveVersion,state: z.enum(["active","revoked"]) });
/** Current or selected historical binding terms; private lineage keys stay server-side. @alpha */
export const ManagedBinding = z.strictObject({ bindingId: id,roleId: id,roleScope: scope,definitionRevision: positiveVersion.nullable(),roleState: state,version: positiveVersion,state: z.enum(["active","revoked"]),termsRevision: positiveVersion,recipient: ManagedAssignmentRecipient,terms: ManagedBindingTermsSchema });
/** Bounded directory of binding identities. @alpha */
export const ManagedBindings = z.strictObject({ items: z.array(z.strictObject({ bindingId: id,roleId: id,version: positiveVersion,termsRevision: positiveVersion,state: z.enum(["active","revoked"]) })).max(100),nextCursor: id.nullable() });
/** Immutable ceiling snapshot with current lifecycle. @alpha */
export const ManagedCeiling = z.strictObject({ ceilingId: id,roleScope: scope,definitionRevision: positiveVersion.nullable(),version: positiveVersion,state: z.enum(["active","revoked"]),managerBindingId: id,managerTermsRevision: positiveVersion,roleId: id,
 targetPath: z.array(z.string()).max(8),recipient: ManagedAssignmentRecipient,permissions: z.array(AccessPermissionSchema),validFrom: z.iso.datetime(),validUntil: z.iso.datetime().nullable(),
 maximumGrantDurationSeconds: positiveVersion.nullable(),grantNotAfter: z.iso.datetime().nullable() });
/** Bounded directory of private confer identities. @alpha */
export const ManagedCeilings = z.strictObject({ items: z.array(ManagedCeiling.pick({ ceilingId: true,roleId: true,version: true,state: true })).max(100),nextCursor: id.nullable() });
/** Private audit history retains exact operations and receipts without identifying operators. @alpha */
export const AssignmentHistory = z.strictObject({ items: z.array(z.strictObject({ version: positiveVersion,operationId: id,operation: z.enum(["create","amend","revoke"]),createdAt: z.iso.datetime() })).max(100),nextCursor: positiveVersion.nullable() });
const inspectedProposal = z.union([
 z.strictObject({ kind: z.literal("role"),operation: z.enum(["activate","retire"]),operationId: id,roleId: id,expectedVersion: positiveVersion,definitionRevision: positiveVersion.nullable() }),
 z.strictObject({ kind: z.literal("binding"),operation: z.enum(["create","amend","revoke"]),operationId: id,bindingId: id,expectedVersion: version,
  definitionRevision: positiveVersion.nullable(),roleScope: scope,roleId: id.nullable(),recipient: ManagedAssignmentRecipient.nullable(),terms: ManagedBindingTermsSchema.nullable() }),
 z.strictObject({ kind: z.literal("ceiling"),operation: z.enum(["create","revoke"]),operationId: id,ceilingId: id,expectedVersion: version,
  terms: ManagedCeiling.omit({ ceilingId: true,version: true,state: true }).extend({ definitionRevision: positiveVersion.nullable(),roleScope: scope }).nullable() }),
]);
/** Full per-page permission impact, scoped private recipient and unchanged full-set digests. @alpha */
export const AssignmentInspection = AssignmentReview.extend({ proposal: inspectedProposal,items: z.array(z.strictObject({ ordinal: positiveVersion,kind: z.enum(["binding","representation","ceiling"]),itemKey: z.string(),sourceVersion: version,termsRevision: positiveVersion.nullable(),
 targetScope: scope,targetPath: z.array(z.string()).max(8),recipient: z.strictObject({ disclosure: z.literal("review-local"),recipientKey: z.string() }),before: z.array(AccessPermissionSchema),after: z.array(AccessPermissionSchema),validFrom: z.iso.datetime(),validUntil: z.iso.datetime().nullable(),confer: z.boolean() })).max(100),nextCursor: positiveVersion.nullable() });
/** Revalidated independent approvals without exposing their private principals. @alpha */
export const AssignmentApprovals = z.strictObject({ reviewId: id,items: z.array(GroupApprovalReceipt.extend({ validity: z.enum(["valid","invalid","unavailable"]) })).max(64) });
