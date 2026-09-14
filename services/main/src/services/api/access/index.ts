import Elysia from "elysia";
import principalSession from "../../auth/principal-session";
import { env } from "../../config";
import { createScopeSelectors } from "../../authorization/scope-selectors";
import { resolveManagedScope } from "../../authorization/scope-management";
import { getManagedRole, listManagedRoleHistory, listManagedRoles, writeRoleDefinition } from "../../authorization/role-management";
import { CreateRoleBody, ManagedRole, ManagedRoleHistory, ManagedRoles, ResolvedScope, ResolveScopeBody,
	ReviseRoleBody, RoleHistoryQuery, RoleListQuery, RoleParams, RoleQuery, RoleReceipt, ScopeParams } from "./schema";

const selectors = createScopeSelectors(env.BETTER_AUTH_SECRET);
const read = { permission: "access:read", fresh: false, write: false } as const;
const manage = { permission: "access:manage", fresh: false, write: true } as const;

/** Native mixed-subject access management, independent from public presentation. @alpha */
export default new Elysia({ prefix: "/access", name: "access-management-api" }).use(principalSession)
	.post("/scopes/resolve", {
		principalAccess: read, body: ResolveScopeBody, response: ResolvedScope,
		detail: { operationId: "resolveAccessManagementScope", tags: ["Access management"] },
	}, async ({ principalContext, body }) => {
		const resolved = await resolveManagedScope(principalContext, body);
		return { scope: selectors.mint(resolved.scopeId, principalContext.credentialProof(), resolved.now),
			expiresAt: new Date(resolved.now + 900_000).toISOString() };
	})
	.get("/:scope/roles", {
		principalAccess: read, params: ScopeParams, query: RoleListQuery, response: ManagedRoles,
		detail: { operationId: "listAccessRoles", tags: ["Access management"] },
	}, ({ principalContext, params, query }) => listManagedRoles(principalContext,
		selectors.resolve(params.scope, principalContext.credentialProof(), Date.now()), query.afterId))
	.get("/:scope/roles/:roleId", {
		principalAccess: read, params: RoleParams, query: RoleQuery, response: ManagedRole,
		detail: { operationId: "getAccessRole", tags: ["Access management"] },
	}, ({ principalContext, params, query }) => getManagedRole(principalContext,
		selectors.resolve(params.scope, principalContext.credentialProof(), Date.now()), params.roleId, query.definitionRevision))
	.get("/:scope/roles/:roleId/history", {
		principalAccess: read, params: RoleParams, query: RoleHistoryQuery, response: ManagedRoleHistory,
		detail: { operationId: "listAccessRoleHistory", tags: ["Access management"] },
	}, ({ principalContext, params, query }) => listManagedRoleHistory(principalContext,
		selectors.resolve(params.scope, principalContext.credentialProof(), Date.now()), params.roleId, query.afterVersion))
	.put("/:scope/roles/:roleId", {
		principalAccess: manage, params: RoleParams, body: CreateRoleBody, response: RoleReceipt,
		detail: { operationId: "createAccessRole", tags: ["Access management"] },
	}, ({ principalContext, params, body }) => writeRoleDefinition(principalContext, { ...body, roleId: params.roleId,
		scopeId: selectors.resolve(params.scope, principalContext.credentialProof(), Date.now()), operation: "create" }))
	.post("/:scope/roles/:roleId/definitions", {
		principalAccess: manage, params: RoleParams, body: ReviseRoleBody, response: RoleReceipt,
		detail: { operationId: "reviseAccessRole", tags: ["Access management"] },
	}, ({ principalContext, params, body }) => writeRoleDefinition(principalContext, { ...body, roleId: params.roleId,
		scopeId: selectors.resolve(params.scope, principalContext.credentialProof(), Date.now()), operation: "revise" }));
