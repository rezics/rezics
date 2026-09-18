import { and, eq, inArray, isNull, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import { AccessManagementPermissionValues, type AccessSubjectTarget, type RequestedAuthoritySelection } from "@rezics/access";
import type { DatabaseTransaction } from "../database";
import { accessRoleBindingScope } from "@rezics/schema/postgres/access/access-role-binding";
import { accessGroupTree } from "@rezics/schema/postgres/access/access-group";
import { accessSubject } from "@rezics/schema/postgres/access/access-identity";
import { platformCapabilityGrant } from "@rezics/schema/postgres/realms/realm";
import { unitOwnership } from "@rezics/schema/postgres/access/access";
import { unitReferenceTargetColumn } from "@rezics/schema/postgres/shared/unit-reference-columns";
import { resolveReferenceValue } from "../units/reference-value";
import { ensureAccountAuthenticationAllowed } from "../auth/account-state";
import { readFirstPartyCredentialAuthority, type FirstPartyCredentialProof } from "../auth/credential-authority";
import type { ApiPermission } from "@rezics/schema/contracts/native/api-permissions";
import { allocateAccessSubject, resolveAccessScope } from "./identities";
import { readAccessSubjectEligibility } from "./subject-eligibility";
import { readSubjectRoleBindingPermissions } from "./role-binding-permissions";
import { evaluateCurrentRepresentationAuthority } from "./representation-authority";
import { RequestedAuthoritySelectionSchema } from "./authority-context";
import { lockUnitAccessState } from "./unit/access-lock";

/** Current management authority denied the requested operation. @internal */
export class ManagementAuthorityDenied extends Error {
	constructor() { super("Current management authority is required"); }
}
/** Current management authority could not be completely established. @internal */
export class ManagementAuthorityUnavailable extends Error {
	constructor() { super("Current management authority is unavailable"); }
}

async function ownsManagementScope(tx: DatabaseTransaction, scopeId: string, subject: AccessSubjectTarget, permission: (typeof AccessManagementPermissionValues)[number]) {
	const scope = await resolveAccessScope(tx, scopeId);
	if (!scope) throw new ManagementAuthorityUnavailable();
	if (scope.kind === "account") return subject.kind === "principal" && subject.id === scope.id ? {
		admission: sql<boolean>`exists(select 1 from public.access_scope where id=${scopeId}::uuid and auth_user_id=${subject.id}::uuid)`,
		identity: `account:${scope.id}`,
	} : null;
	if (scope.kind === "platform") {
  // This explicit bridge bootstraps native IAM only. A native binding cannot mint
  // its own root capability, and represented subjects cannot borrow the operator's.
  if (subject.kind !== "principal" || ![
   "access.role.read", "access.role.create", "access.role.update", "access.role.activate", "access.role.retire",
   "access.role-binding.manage", "access.assignment-ceiling.manage",
  ].includes(permission)) return null;
  const [grant] = await tx.select().from(platformCapabilityGrant).where(and(eq(platformCapabilityGrant.authUserId,subject.id),
   eq(platformCapabilityGrant.capability,"platform.access.manage"),isNull(platformCapabilityGrant.revokedAt),
   sql`(${platformCapabilityGrant.expiresAt} is null or ${platformCapabilityGrant.expiresAt}>clock_timestamp())`)).for("share");
  return grant ? { identity: `platform-capability:${grant.id}:${grant.expiresAt?.toISOString() ?? "durable"}`,validUntil: grant.expiresAt?.getTime() ?? null,admission: sql<boolean>`exists(select 1 from public.platform_capability_grant
   where id=${grant.id}::uuid and auth_user_id=${subject.id}::uuid and capability='platform.access.manage' and revoked_at is null
   and (expires_at is null or expires_at>clock_timestamp()))` } : null;
 }
	const reference = await resolveReferenceValue(tx, scope.referenceValueId);
	if (!reference) throw new ManagementAuthorityUnavailable();
	await lockUnitAccessState(tx, [reference.id], "shared");
	// Directory metadata ownership is not control of an Entity's identity/governance.
	if (reference.owner === "entity") return subject.kind === "entity" && subject.id === reference.id ? {
		admission: sql<boolean>`exists(select 1 from public.access_scope s join public.reference_value r on r.id=s.unit_ref
			where s.id=${scopeId}::uuid and r.target_entity_id=${subject.id}::uuid)`, identity: `entity:${reference.id}`,
	} : null;
	if (subject.kind !== "entity") return null;
	const [owner] = await tx.select({ id: unitOwnership.id }).from(unitOwnership).where(and(
		eq(unitReferenceTargetColumn("unit", reference.owner, unitOwnership), reference.id),
		eq(unitOwnership.profileId, subject.id), isNull(unitOwnership.revokedAt),
	)).for("share");
	return owner ? { identity: owner.id, admission: sql<boolean>`exists(select 1 from ${unitOwnership} where ${unitOwnership.id}=${owner.id}::uuid
		and ${unitOwnership.profileId}=${subject.id}::uuid and ${unitOwnership.revokedAt} is null
		and ${unitReferenceTargetColumn("unit", reference.owner, unitOwnership)}=${reference.id}::uuid)` } : null;
}

/**
 * Compose first-party actor, credential, representation and management permission at one root.
 * @internal
 * @remarks The domain owner must supply current side-effect-free scope admission:
 * resource lifecycle/restrictions, applicability, confer/impact limits and recovery
 * or independent approvals. It must discover/promote overlapping mutation fences
 * before this call. This function does not infer confer rights from metadata ownership.
 * The returned SQL is usable only in the same retained transaction; retry from
 * discovery after rollback. It rechecks scope policy and the chosen proof's deadline
 * at the primitive effect, rather than turning a point decision into a lasting grant.
 */
export async function readManagementAuthority(
	tx: DatabaseTransaction,
	input: {
		proof: FirstPartyCredentialProof;
		selection: RequestedAuthoritySelection;
		scopeId: string;
		path: string[];
		permission: (typeof AccessManagementPermissionValues)[number];
		apiPermission: ApiPermission | null;
		requireFreshSession: boolean;
		mutation: boolean;
        excludeBindingId?: string;
        excludeRoleId?: string;
	},
	scopeAdmission: SQL<boolean | null>,
) {
	const selection = RequestedAuthoritySelectionSchema.parse(input.selection);
	const scopeId = z.uuid().toLowerCase().parse(input.scopeId);
	const path = z.array(z.string().regex(/^[a-z0-9][a-z0-9-]{0,255}$/)).max(8).parse(input.path);
	const permission = z.enum(AccessManagementPermissionValues).parse(input.permission);
	const credential = await readFirstPartyCredentialAuthority(tx, { proof: input.proof, selection,
		apiPermission: input.apiPermission, requireFreshSession: input.requireFreshSession, requireVerifiedEmail: input.mutation });
	await ensureAccountAuthenticationAllowed(credential.principalId, tx);
	const principalSubjectId = await allocateAccessSubject(tx, { kind: "principal", id: credential.principalId });
	let subjectId = principalSubjectId;
	let subject: AccessSubjectTarget = { kind: "principal", id: credential.principalId };
	if (selection.mode === "represented") {
		const [value] = await tx.select({ id: accessSubject.id }).from(accessSubject).where(eq(accessSubject.entityId, selection.entityId)).limit(1);
		if (!value) throw new ManagementAuthorityDenied();
		subjectId = value.id; subject = { kind: "entity", id: selection.entityId };
	}
	const fenceQuery = tx.select({ id: accessRoleBindingScope.scopeId }).from(accessRoleBindingScope).where(eq(accessRoleBindingScope.scopeId, scopeId));
	const [fence] = input.mutation ? await fenceQuery.for("update") : await fenceQuery.for("share");
	if (!fence) throw new ManagementAuthorityUnavailable();
	const owner = await ownsManagementScope(tx, scopeId, subject, permission);
	const roleSources = owner ? null : await readSubjectRoleBindingPermissions(tx, { subjectId, targets: [{ scopeId, path }] });
	const source = roleSources?.bindings.find(binding => binding.active && binding.binding.id !== input.excludeBindingId && binding.binding.roleId !== input.excludeRoleId && binding.permissions.some(value => value.family === "management" && value.key === permission));
	if (!owner && !source) throw new ManagementAuthorityDenied();
	const represented = selection.mode === "represented" ? await evaluateCurrentRepresentationAuthority(tx, {
		principalId: credential.principalId, selection, operation: { scopeId, path, permission: { family: "management", key: permission } },
		action: input.mutation ? "write" : "read", freshSession: credential.freshSession, freshSessionValidUntil: credential.freshSessionValidUntil,
	}) : null;
	if (represented?.outcome === "deny") throw new ManagementAuthorityDenied();
	if (represented?.outcome === "unavailable") throw new ManagementAuthorityUnavailable();
 const representationEvidence = represented && "sourceEvidence" in represented ? represented.sourceEvidence : null;
 const treeIds = [...new Set([...(roleSources?.memberships.map(member => member.scopeId) ?? []),
  ...(representationEvidence?.memberSets.flatMap(set => set.memberships.map(member => member.scopeId)) ?? [])])].sort();
 if (treeIds.length>64) throw new ManagementAuthorityUnavailable();
 const treeVersions = treeIds.length ? await tx.select({ scopeId: accessGroupTree.scopeId,version: accessGroupTree.version }).from(accessGroupTree)
  .where(inArray(accessGroupTree.scopeId,treeIds)).orderBy(accessGroupTree.scopeId).for("share") : [];
 if (treeVersions.length!==treeIds.length) throw new ManagementAuthorityUnavailable();
	const subjects = await readAccessSubjectEligibility(tx, { subjectIds: [...new Set([principalSubjectId, subjectId])], action: input.mutation ? "write" : "read" });
	if (subjects.some(value => value.outcome === "deny")) throw new ManagementAuthorityDenied();
	if (subjects.some(value => value.outcome !== "allow")) throw new ManagementAuthorityUnavailable();
	const deadlines = [credential.validUntil, owner && "validUntil" in owner ? owner.validUntil : null, represented?.validUntil, source?.terms.validUntil?.getTime(), ...subjects.map(value => value.validUntil)]
		.filter((value): value is number => value !== undefined && value !== null);
	const validUntil = deadlines.length ? Math.min(...deadlines) : null;
	const actorAction = input.mutation ? "write" : "read";
	const managementCurrent = owner?.admission ?? (source ? sql<boolean>`exists(select 1 from public.access_role_binding b join public.access_role r on r.id=b.role_id
		where b.id=${source.binding.id}::uuid and b.version=${source.binding.version} and b.state='active' and b.terms_revision=${source.terms.revision}
		and r.version=${source.roleVersion} and r.state='active'
		and public.access_role_binding_recipient_is_current(b.id,b.terms_revision) is true
		and public.access_subject_matches_recipient(${subjectId}::uuid,b.recipient_kind,b.recipient_subject_id,b.recipient_scope_id,b.recipient_group_id) is true)` : sql<boolean>`false`);
	const representationCurrent = selection.mode === "represented" && represented?.outcome === "allow"
		? sql<boolean>`public.access_representation_path_is_current(
			array[${sql.join(represented.path.map(ref => sql`${ref.id}::uuid`), sql`, `)}],
			array[${sql.join(represented.path.map(ref => sql`${ref.revision}::bigint`), sql`, `)}],
			${principalSubjectId}::uuid,${selection.entityId}::uuid,${actorAction})`
		: sql<boolean>`true`;
	const admission: SQL<boolean | null> = sql`(${scopeAdmission}) and (${credential.admission}) and (${managementCurrent}) and (${representationCurrent})
		and exists(select 1 from public.users where id=${credential.principalId}::uuid and principal_kind='human' ${input.mutation ? sql`and email_verified` : sql``})
		and public.access_subject_is_eligible(${principalSubjectId}::uuid,${actorAction}) is true
		and public.access_subject_is_eligible(${subjectId}::uuid,${actorAction}) is true
		and (${validUntil === null ? sql`true` : sql`clock_timestamp()<${new Date(validUntil)}::timestamptz`})`;
	const result = (await tx.execute<{ admitted: boolean | null }>(sql`select (${admission}) as admitted`)).rows[0]?.admitted;
	if (result === false) throw new ManagementAuthorityDenied();
	if (result !== true) throw new ManagementAuthorityUnavailable();
	return { scopeId, path, permission, principalId: credential.principalId, subjectId, subject, selection, credential, owner: owner !== null,
		sourceEvidence: { trees: treeVersions, owner: owner?.identity ?? null,
   memberships: roleSources?.memberships.map(member => ({ id: member.id,version: member.version,generation: member.activeGeneration })) ?? [],
   selections: roleSources?.selections ?? [], representation: representationEvidence },
  sourceBindingId: source?.binding.id ?? null, sourceBinding: source ?? null, representationPath: represented?.path ?? [], validUntil, admission };
}
