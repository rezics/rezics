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
/** Move one Group; populated assignment impact is currently unavailable. @alpha */
export const ReparentGroupBody = z.strictObject({ operationId: id, expectedVersion: positiveVersion, parentId: id.nullable() });
/** Retire one Group; dependent authority requires pending recovery admission. @alpha */
export const RetireGroupBody = z.strictObject({ operationId: id, expectedVersion: positiveVersion });
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
export const GroupImpactSummary = z.strictObject({ reviewId: id, operation: z.enum(["reparent", "retire"]),
	expectedGroupVersion: positiveVersion, expectedTreeVersion: version, proposedParentId: id.nullable(),
	status: z.enum(["discovering", "complete", "invalidated", "unavailable"]), reason: z.enum(["changed", "expired", "budget", "missing"]).nullable(),
	pageVersion: version, discoveredItems: version, validUntil: z.iso.datetime(), admission: z.literal("not-evaluated") });
/** Facts use opaque review-local identifiers; private recipient mappings and external target ids are omitted. @alpha */
export const GroupImpactInspection = GroupImpactSummary.extend({ items: z.array(z.strictObject({ itemId: id,
	ordinal: positiveVersion, kind: z.string(), version: version.nullable(), termsRevision: version.nullable(), state: z.string().nullable() })).max(100),
	nextCursor: positiveVersion.nullable() });
