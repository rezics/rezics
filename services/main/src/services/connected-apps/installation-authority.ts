import { and, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { accessPermissionCeilingCovers, accessPermissionKey, scopeCovers, type AccessPermission } from "@rezics/access";
import type { DatabaseTransaction } from "../database";
import { accessSubject } from "../database/schema/access-identity";
import { accessRoleBinding } from "../database/schema/access-role-binding";
import { AuthorityOperationSchema } from "../authorization/authority-context";
import { readCurrentAccessRoleBindingPermissions } from "../authorization/role-binding-permissions";
import { readAccessSubjectEligibility } from "../authorization/subject-eligibility";
import { evaluateCurrentRepresentationAuthority } from "../authorization/representation-authority";
import { ApiPermissionValues, type ApiPermission } from "../auth/api-permissions";
import type { AppCapability } from "./capabilities";
import type { readAppClientAdmission } from "./client-admission";
import { InstallationDenied, InstallationUnavailable } from "./installations";

function domainCapabilities(values: readonly AppCapability[]): AccessPermission[] {
	return values.filter((value): value is AccessPermission => value.family !== "api");
}

/**
 * Resolve the approved installation contribution for one operation and optional public attribution.
 * @internal
 * @remarks Admission must come from the current reader in this retained transaction,
 * never from a request. The resource owner still applies its restrictions, structural
 * capabilities and operation-specific invariants. Token scope, expiry, sender proof
 * and quota also remain mandatory. Unrelated grants held by the workload cannot fill
 * an approved path's missing permission. Attribution does not change the data subject.
 */
export async function readInstallationOperationAuthority(tx: DatabaseTransaction,
	admitted: Awaited<ReturnType<typeof readAppClientAdmission>>,
	input: { operation: z.infer<typeof AuthorityOperationSchema>; apiPermission: ApiPermission; action: "read" | "write" | "contribute"; requirePublicAttribution: boolean },
) {
	const request = z.strictObject({ operation: AuthorityOperationSchema, apiPermission: z.enum(ApiPermissionValues),
		action: z.enum(["read", "write", "contribute"]), requirePublicAttribution: z.boolean() }).parse(input);
	const { workload, installation, installationApproval: approval, terms } = admitted;
	if (admitted.client.kind !== "installation" || !workload || !installation || !approval) throw new InstallationDenied();
	for (const ceiling of [terms.capabilities, approval.capabilities]) {
		if (!ceiling.some(value => value.family === "api" && value.key === request.apiPermission) ||
			!accessPermissionCeilingCovers([request.operation.permission], domainCapabilities(ceiling))) throw new InstallationDenied();
	}
	const [subject] = await tx.select({ id: accessSubject.id }).from(accessSubject).where(eq(accessSubject.authUserId, workload.authUserId)).limit(1);
	if (!subject) throw new InstallationUnavailable();
	const candidates = approval.bindings.length ? await tx.select({ bindingId: accessRoleBinding.id,
		targetScopeId: accessRoleBinding.targetScopeId, version: accessRoleBinding.version }).from(accessRoleBinding)
		.where(and(inArray(accessRoleBinding.id, approval.bindings.map(value => value.id)), eq(accessRoleBinding.targetScopeId, request.operation.scopeId),
			eq(accessRoleBinding.recipientKind, "subject"), eq(accessRoleBinding.recipientSubjectId, subject.id))).limit(65) : [];
	if (candidates.length > 64) throw new InstallationUnavailable();
	const bindings = await readCurrentAccessRoleBindingPermissions(tx, candidates);
	const selected = bindings.find(value => value.active && value.terms.permissionPolicy === "frozen-ceiling" &&
		approval.bindings.some(ref => ref.id === value.binding.id && ref.revision === value.terms.revision) &&
		scopeCovers(value.terms.targetPath, request.operation.path) &&
		value.permissions.some(permission => accessPermissionKey(permission) === accessPermissionKey(request.operation.permission)));
	if (!selected) throw new InstallationDenied();
	const [actor] = await readAccessSubjectEligibility(tx, { subjectIds: [subject.id], action: request.action });
	if (actor?.outcome === "deny") throw new InstallationDenied();
	if (actor?.outcome !== "allow") throw new InstallationUnavailable();
	const attribution = request.requirePublicAttribution ? approval.attribution : null;
	if (request.requirePublicAttribution && (!attribution || !terms.entityDisclosure)) throw new InstallationDenied();
	const representation = attribution ? await evaluateCurrentRepresentationAuthority(tx, {
		principalId: workload.authUserId, selection: { mode: "represented", entityId: attribution.entityId, representations: attribution.representations },
		operation: request.operation, action: request.action, freshSession: false, freshSessionValidUntil: null,
	}) : null;
	if (representation?.outcome === "deny") throw new InstallationDenied();
	if (representation?.outcome === "unavailable") throw new InstallationUnavailable();
	const deadlines = [approval.validUntil?.getTime(), selected.terms.validUntil?.getTime(), actor.validUntil, representation?.validUntil]
		.filter((value): value is number => typeof value === "number");
	const validUntil = deadlines.length ? Math.min(...deadlines) : null;
	const attributionAdmission = attribution && representation?.outcome === "allow"
		? sql<boolean>`public.access_representation_path_is_current(
			array[${sql.join(representation.path.map(value => sql`${value.id}::uuid`), sql`, `)}],
			array[${sql.join(representation.path.map(value => sql`${value.revision}::bigint`), sql`, `)}],
			${subject.id}::uuid,${attribution.entityId}::uuid,${request.action}) is true` : sql<boolean>`true`;
	const admission = sql<boolean>`(${admitted.admission}) and (${attributionAdmission})
		and public.access_subject_is_eligible(${subject.id}::uuid,${request.action}) is true
		and exists(select 1 from public.access_role_binding b join public.access_role r on r.id=b.role_id
		 where b.id=${selected.binding.id}::uuid and b.version=${selected.binding.version} and b.terms_revision=${selected.terms.revision}
		 and b.state='active' and b.recipient_subject_id=${subject.id}::uuid and r.version=${selected.roleVersion} and r.state='active'
		 and public.access_role_binding_recipient_is_current(b.id,b.terms_revision) is true)
		and (${validUntil === null ? sql`true` : sql`clock_timestamp()<${new Date(validUntil)}::timestamptz`})`;
	const current = (await tx.execute<{ admitted: boolean | null }>(sql`select (${admission}) as admitted`)).rows[0]?.admitted;
	if (current === false) throw new InstallationDenied();
	if (current !== true) throw new InstallationUnavailable();
	return { subjectId: subject.id, principalId: workload.authUserId, installationId: installation.id,
		attributionEntityId: attribution?.entityId ?? null, bindingId: selected.binding.id, validUntil, admission };
}
