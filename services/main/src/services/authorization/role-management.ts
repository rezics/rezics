import { and, desc, eq, gt, sql } from "drizzle-orm";
import type { AccessPermission } from "@rezics/access";
import type { PrincipalRequestContext } from "../auth/principal-session";
import { accessRole, accessRoleEvent, accessRoleRevision } from "../database/schema/access-role";
import { applyAccessRoleCommand, readAccessRoleSnapshot } from "./roles";
import { readManagementAuthority } from "./management-authority";
import { scopeLifecycleAdmission } from "./scope-policy";
import { runAccessTransaction } from "./transaction";
import { AccessRecordUnavailable } from "./http-errors";

/** Prepare role definitions without activating their data permissions. @internal */
export async function writeRoleDefinition(context: PrincipalRequestContext, input: {
	scopeId: string; roleId: string; operationId: string; expectedVersion: number;
	operation: "create" | "revise"; definition: { label: string; description: string | null; permissions: AccessPermission[] };
}) {
	return runAccessTransaction(async tx => {
		const lifecycle = await scopeLifecycleAdmission(tx, input.scopeId, true);
		const authority = await readManagementAuthority(tx, { proof: context.credentialProof(), selection: context.selection,
			scopeId: input.scopeId, path: ["roles", input.roleId], permission: input.operation === "create" ? "access.role.create" : "access.role.update",
			apiPermission: "access:manage", requireFreshSession: false, mutation: true }, lifecycle);
		return applyAccessRoleCommand(tx, { ...input, operatorAuthUserId: authority.principalId, authoritySubjectId: authority.subjectId }, authority.admission);
	});
}
/** Inspect one definition/control head after scoped management admission, without private issuer identity. @internal */
export async function getManagedRole(context: PrincipalRequestContext, scopeId: string, roleId: string, definitionRevision?: number) {
	return runAccessTransaction(async tx => {
		const lifecycle = await scopeLifecycleAdmission(tx, scopeId, false);
		await readManagementAuthority(tx, { proof: context.credentialProof(), selection: context.selection, scopeId,
			path: ["roles", roleId], permission: "access.role.read", apiPermission: "access:read", requireFreshSession: false, mutation: false }, lifecycle);
		const [head] = await tx.select().from(accessRole).where(and(eq(accessRole.id, roleId), eq(accessRole.scopeId, scopeId))).for("share");
		if (!head) throw new AccessRecordUnavailable();
		const [latest] = await tx.select({ revision: accessRoleRevision.revision }).from(accessRoleRevision)
			.where(eq(accessRoleRevision.roleId, roleId)).orderBy(desc(accessRoleRevision.revision)).limit(1);
		const revision = definitionRevision ?? latest?.revision;
		const definition = revision === undefined ? null : await readAccessRoleSnapshot(tx, { scopeId, roleId, revision });
		if (!definition) throw new AccessRecordUnavailable();
		return { id: head.id, version: head.version, state: head.state, activeRevision: head.activeRevision,
			definition: { revision: definition.revision, label: definition.label, description: definition.description, permissions: definition.permissions } };
	});
}
/** Broad role-directory read uses a keyset and bounded latest-definition hydration. @internal */
export async function listManagedRoles(context: PrincipalRequestContext, scopeId: string, afterId?: string) {
	return runAccessTransaction(async tx => {
		const lifecycle = await scopeLifecycleAdmission(tx, scopeId, false);
		await readManagementAuthority(tx, { proof: context.credentialProof(), selection: context.selection, scopeId,
			path: ["roles"], permission: "access.role.read", apiPermission: "access:read", requireFreshSession: false, mutation: false }, lifecycle);
		const rows = (await tx.execute<{ id: string; version: string; state: "draft" | "active" | "retired"; active_revision: string | null; definition_revision: string; label: string }>(sql`
		 select r.id,r.version::text,r.state,r.active_revision::text,definition.revision::text as definition_revision,definition.label
		 from public.access_role r cross join lateral(select revision,label from public.access_role_revision d where d.role_id=r.id and d.sealed order by revision desc limit 1) definition
		 where r.scope_id=${scopeId}::uuid ${afterId ? sql`and r.id>${afterId}::uuid` : sql``} order by r.id limit 101`)).rows;
		const page = rows.slice(0, 100);
		return { items: page.map(row => ({ id: row.id, version: Number(row.version), state: row.state,
			activeRevision: row.active_revision === null ? null : Number(row.active_revision), definitionRevision: Number(row.definition_revision), label: row.label })),
			nextCursor: rows.length > 100 ? page.at(-1)?.id ?? null : null };
	});
}
/** Read bounded control history; public responses contain no raw private operator or subject IDs. @internal */
export async function listManagedRoleHistory(context: PrincipalRequestContext, scopeId: string, roleId: string, afterVersion?: number) {
	return runAccessTransaction(async tx => {
		const lifecycle = await scopeLifecycleAdmission(tx, scopeId, false);
		await readManagementAuthority(tx, { proof: context.credentialProof(), selection: context.selection, scopeId,
			path: ["roles", roleId], permission: "access.role.read", apiPermission: "access:read", requireFreshSession: false, mutation: false }, lifecycle);
		const [role] = await tx.select({ id: accessRole.id }).from(accessRole).where(and(eq(accessRole.id, roleId), eq(accessRole.scopeId, scopeId))).limit(1);
		if (!role) throw new AccessRecordUnavailable();
		const rows = await tx.select({ version: accessRoleEvent.version, operationId: accessRoleEvent.operationId, operation: accessRoleEvent.operation,
			state: accessRoleEvent.stateAfter, activeRevision: accessRoleEvent.activeRevision, createdAt: accessRoleEvent.createdAt }).from(accessRoleEvent)
			.where(and(eq(accessRoleEvent.roleId, roleId), afterVersion !== undefined ? gt(accessRoleEvent.version, afterVersion) : undefined))
			.orderBy(accessRoleEvent.version).limit(101);
		const page = rows.slice(0, 100);
		return { items: page.map(row => ({ ...row, createdAt: row.createdAt.toISOString() })), nextCursor: rows.length > 100 ? page.at(-1)?.version ?? null : null };
	});
}
