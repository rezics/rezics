import Elysia from "elysia";
import { toApiErrorResponse } from "../schema/error-response";
import principalSession from "../../auth/principal-session";
import { env } from "../../config";
import { createScopeSelectors } from "../../authorization/scope-selectors";
import { resolveManagedScope } from "../../authorization/scope-management";
import { getManagedRole, listManagedRoleHistory, listManagedRoles, writeRoleDefinition } from "../../authorization/role-management";
import { getManagedGroupImpactContext, startManagedGroupImpact, advanceManagedGroupImpact, inspectManagedGroupImpact, getManagedGroup, listManagedGroupHistory, listManagedGroups, writeManagedGroup } from "../../authorization/group-management";
import { GroupImpactContext, StartGroupImpactBody, GroupImpactParams, AdvanceGroupImpactBody, GroupImpactQuery, GroupImpactSummary, GroupImpactInspection, CreateGroupBody, GroupHistoryQuery, GroupListQuery, GroupParams, GroupQuery, GroupReceipt,
	ManagedGroup, ManagedGroupHistory, ManagedGroups, ReparentGroupBody, RetireGroupBody, UpdateGroupBody } from "./schema";
import { CreateRoleBody, ManagedRole, ManagedRoleHistory, ManagedRoles, ResolvedScope, ResolveScopeBody,
	ReviseRoleBody, RoleHistoryQuery, RoleListQuery, RoleParams, RoleQuery, RoleReceipt, ScopeParams } from "./schema";

const selectors = createScopeSelectors(env.BETTER_AUTH_SECRET);
const read = { permission: "access:read", fresh: false, write: false } as const;
const manage = { permission: "access:manage", fresh: false, write: true } as const;
const groupErrors = {
	400: toApiErrorResponse(["AccessInputInvalid"]),
	401: toApiErrorResponse(["AuthenticationRequired", "InteractiveSessionRequired"]),
	403: toApiErrorResponse(["AccessDenied", "ApiTokenPermissionRequired", "FreshSessionRequired", "EmailVerificationRequired", "AccountSuspended", "AccountClosed"]),
	404: toApiErrorResponse(["AccessRecordUnavailable"]),
	409: toApiErrorResponse(["AccessChanged"]),
	503: toApiErrorResponse(["AccessUnavailable"]),
};

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
		scopeId: selectors.resolve(params.scope, principalContext.credentialProof(), Date.now()), operation: "revise" }))
	.get("/:scope/groups", {
		principalAccess: read, params: ScopeParams, query: GroupListQuery, response: { 200: ManagedGroups, ...groupErrors },
		detail: { operationId: "listAccessGroups", tags: ["Access management"] },
	}, ({ principalContext, params, query }) => listManagedGroups(principalContext,
		selectors.resolve(params.scope, principalContext.credentialProof(), Date.now()), query.afterId))
	.get("/:scope/groups/:groupId", {
		principalAccess: read, params: GroupParams, query: GroupQuery, response: { 200: ManagedGroup, ...groupErrors },
		detail: { operationId: "getAccessGroup", tags: ["Access management"] },
	}, ({ principalContext, params, query }) => getManagedGroup(principalContext,
		selectors.resolve(params.scope, principalContext.credentialProof(), Date.now()), params.groupId, query.version))
	.get("/:scope/groups/:groupId/history", {
		principalAccess: read, params: GroupParams, query: GroupHistoryQuery, response: { 200: ManagedGroupHistory, ...groupErrors },
		detail: { operationId: "listAccessGroupHistory", tags: ["Access management"] },
	}, ({ principalContext, params, query }) => listManagedGroupHistory(principalContext,
		selectors.resolve(params.scope, principalContext.credentialProof(), Date.now()), params.groupId, query.afterVersion))
	.get("/:scope/groups/:groupId/impact-context", {
		principalAccess: read, params: GroupParams, response: { 200: GroupImpactContext, ...groupErrors },
		detail: { operationId: "getAccessGroupImpactContext", tags: ["Access management"] },
	}, ({ principalContext, params }) => getManagedGroupImpactContext(principalContext,
		selectors.resolve(params.scope, principalContext.credentialProof(), Date.now()), params.groupId))
	.post("/:scope/groups/:groupId/impact-reviews", {
		principalAccess: read, params: GroupParams, body: StartGroupImpactBody, response: { 200: GroupImpactSummary, ...groupErrors },
		detail: { operationId: "startAccessGroupImpact", tags: ["Access management"] },
	}, ({ principalContext, params, body }) => startManagedGroupImpact(principalContext, { ...body, groupId: params.groupId,
		scopeId: selectors.resolve(params.scope, principalContext.credentialProof(), Date.now()) }))
	.post("/:scope/groups/:groupId/impact-reviews/:reviewId/pages", {
		principalAccess: read, params: GroupImpactParams, body: AdvanceGroupImpactBody, response: { 200: GroupImpactSummary, ...groupErrors },
		detail: { operationId: "advanceAccessGroupImpact", tags: ["Access management"] },
	}, ({ principalContext, params, body }) => advanceManagedGroupImpact(principalContext, { ...body, reviewId: params.reviewId, groupId: params.groupId,
		scopeId: selectors.resolve(params.scope, principalContext.credentialProof(), Date.now()) }))
	.get("/:scope/groups/:groupId/impact-reviews/:reviewId", {
		principalAccess: read, params: GroupImpactParams, query: GroupImpactQuery, response: { 200: GroupImpactInspection, ...groupErrors },
		detail: { operationId: "inspectAccessGroupImpact", tags: ["Access management"] },
	}, ({ principalContext, params, query }) => inspectManagedGroupImpact(principalContext, { ...query, reviewId: params.reviewId, groupId: params.groupId,
		scopeId: selectors.resolve(params.scope, principalContext.credentialProof(), Date.now()) }))
	.put("/:scope/groups/:groupId", {
		principalAccess: manage, params: GroupParams, body: CreateGroupBody, response: { 200: GroupReceipt, ...groupErrors },
		detail: { operationId: "createAccessGroup", tags: ["Access management"] },
	}, ({ principalContext, params, body }) => writeManagedGroup(principalContext, { ...body, groupId: params.groupId,
		scopeId: selectors.resolve(params.scope, principalContext.credentialProof(), Date.now()), operation: "create" }))
	.patch("/:scope/groups/:groupId/presentation", {
		principalAccess: manage, params: GroupParams, body: UpdateGroupBody, response: { 200: GroupReceipt, ...groupErrors },
		detail: { operationId: "updateAccessGroupPresentation", tags: ["Access management"] },
	}, ({ principalContext, params, body }) => writeManagedGroup(principalContext, { ...body, groupId: params.groupId,
		scopeId: selectors.resolve(params.scope, principalContext.credentialProof(), Date.now()), operation: "update" }))
	.post("/:scope/groups/:groupId/reparent", {
		principalAccess: { ...manage, fresh: true }, params: GroupParams, body: ReparentGroupBody, response: { 200: GroupReceipt, ...groupErrors },
		detail: { operationId: "reparentAccessGroup", tags: ["Access management"] },
	}, ({ principalContext, params, body }) => writeManagedGroup(principalContext, { ...body, groupId: params.groupId,
		scopeId: selectors.resolve(params.scope, principalContext.credentialProof(), Date.now()), operation: "reparent" }))
	.post("/:scope/groups/:groupId/retire", {
		principalAccess: { ...manage, fresh: true }, params: GroupParams, body: RetireGroupBody, response: { 200: GroupReceipt, ...groupErrors },
		detail: { operationId: "retireAccessGroup", tags: ["Access management"] },
	}, ({ principalContext, params, body }) => writeManagedGroup(principalContext, { ...body, groupId: params.groupId,
		scopeId: selectors.resolve(params.scope, principalContext.credentialProof(), Date.now()), operation: "retire" }));
