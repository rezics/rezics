import Elysia from "elysia";
import principalSession from "../../auth/principal-session";
import { env } from "../../config";
import { createScopeSelectors } from "../../authorization/scope-selectors";
import {
	selectAssignmentRecipient,
	listAssignmentRecipients,
} from "../../authorization/assignment-recipients";
import {
	listAssignmentApprovals,
	startAssignmentReview,
	inspectAssignmentReview,
	approveAssignmentReview,
	revokeAssignmentApproval,
	executeAssignmentReview,
	listManagedBindings,
	getManagedBinding,
	listManagedCeilings,
	getManagedCeiling,
	listAssignmentHistory,
} from "../../authorization/assignment-management";
import { toApiErrorResponse } from "../schema/error-response";
import {
	ScopeParams,
	RoleParams,
	RoleReceipt,
	RoleListQuery,
	RoleHistoryQuery,
	GroupQuery,
	RevokeEvidenceBody,
	GroupApprovalReceipt,
	AssignmentApprovals,
	AssignmentSubject,
	SelectAssignmentRecipientBody,
	AssignmentRecipientsBody,
	AssignmentRecipients,
	BindingParams,
	CeilingParams,
	AssignmentReviewParams,
	AssignmentApprovalParams,
	ExecuteAssignmentBody,
	ApproveAssignmentBody,
	AssignmentImpactQuery,
	AssignmentReview,
	AssignmentProposalBody,
	AssignmentInspection,
	BindingReceipt,
	CeilingReceipt,
	ManagedBinding,
	ManagedBindings,
	ManagedCeiling,
	ManagedCeilings,
	AssignmentHistory,
} from "./schema";
const selectors = createScopeSelectors(env.BETTER_AUTH_SECRET);
const read = { permission: "access:read", fresh: false, write: false } as const;
const manage = { permission: "access:manage", fresh: true, write: true } as const;
const errors = {
	400: toApiErrorResponse(["AccessInputInvalid"]),
	401: toApiErrorResponse(["AuthenticationRequired", "InteractiveSessionRequired"]),
	403: toApiErrorResponse([
		"AccessDenied",
		"ApiTokenPermissionRequired",
		"FreshSessionRequired",
		"EmailVerificationRequired",
		"AccountSuspended",
		"AccountClosed",
	]),
	404: toApiErrorResponse(["AccessRecordUnavailable"]),
	409: toApiErrorResponse(["AccessChanged"]),
	503: toApiErrorResponse(["AccessUnavailable"]),
};
/** Private native assignment operations; every adapter delegates to one server-owned admission protocol. @alpha */
export default new Elysia({ name: "native-assignment-management-api" })
	.use(principalSession)
	.post(
		"/:scope/assignment-recipients/select",
		{
			principalAccess: read,
			params: ScopeParams,
			body: SelectAssignmentRecipientBody,
			response: { 200: AssignmentSubject, ...errors },
			detail: { operationId: "selectAccessAssignmentRecipient", tags: ["Access management"] },
		},
		({ principalContext, params, body }) =>
			selectAssignmentRecipient(
				principalContext,
				selectors.resolve(params.scope, principalContext.credentialProof(), Date.now()),
				body,
			),
	)
	.post(
		"/:scope/assignment-recipients/query",
		{
			principalAccess: read,
			params: ScopeParams,
			body: AssignmentRecipientsBody,
			response: { 200: AssignmentRecipients, ...errors },
			detail: { operationId: "listAccessAssignmentRecipients", tags: ["Access management"] },
		},
		({ principalContext, params, body }) =>
			listAssignmentRecipients(
				principalContext,
				selectors.resolve(params.scope, principalContext.credentialProof(), Date.now()),
				selectors.resolve(body.recipientScope, principalContext.credentialProof(), Date.now()),
				body,
			),
	)
	.post(
		"/:scope/assignment-reviews",
		{
			principalAccess: manage,
			params: ScopeParams,
			body: AssignmentProposalBody,
			response: { 200: AssignmentReview, ...errors },
			detail: { operationId: "startAccessAssignmentReview", tags: ["Access management"] },
		},
		({ principalContext, params, body }) =>
			startAssignmentReview(
				principalContext,
				selectors.resolve(params.scope, principalContext.credentialProof(), Date.now()),
				body,
			),
	)
	.get(
		"/:scope/assignment-reviews/:reviewId",
		{
			principalAccess: manage,
			params: AssignmentReviewParams,
			query: AssignmentImpactQuery,
			response: { 200: AssignmentInspection, ...errors },
			detail: { operationId: "inspectAccessAssignmentReview", tags: ["Access management"] },
		},
		({ principalContext, params, query }) =>
			inspectAssignmentReview(
				principalContext,
				selectors.resolve(params.scope, principalContext.credentialProof(), Date.now()),
				params.reviewId,
				query.afterOrdinal,
			),
	)
	.get(
		"/:scope/assignment-reviews/:reviewId/approvals",
		{
			principalAccess: manage,
			params: AssignmentReviewParams,
			response: { 200: AssignmentApprovals, ...errors },
			detail: { operationId: "listAccessAssignmentApprovals", tags: ["Access management"] },
		},
		({ principalContext, params }) =>
			listAssignmentApprovals(
				principalContext,
				selectors.resolve(params.scope, principalContext.credentialProof(), Date.now()),
				params.reviewId,
			),
	)
	.post(
		"/:scope/assignment-reviews/:reviewId/approvals",
		{
			principalAccess: manage,
			params: AssignmentReviewParams,
			body: ApproveAssignmentBody,
			response: { 200: GroupApprovalReceipt, ...errors },
			detail: { operationId: "approveAccessAssignmentReview", tags: ["Access management"] },
		},
		({ principalContext, params, body }) =>
			approveAssignmentReview(
				principalContext,
				selectors.resolve(params.scope, principalContext.credentialProof(), Date.now()),
				params.reviewId,
				body,
			),
	)
	.post(
		"/:scope/assignment-reviews/:reviewId/approvals/:approvalId/revoke",
		{
			principalAccess: manage,
			params: AssignmentApprovalParams,
			body: RevokeEvidenceBody,
			response: { 200: GroupApprovalReceipt, ...errors },
			detail: { operationId: "revokeAccessAssignmentApproval", tags: ["Access management"] },
		},
		({ principalContext, params, body }) =>
			revokeAssignmentApproval(
				principalContext,
				selectors.resolve(params.scope, principalContext.credentialProof(), Date.now()),
				params.reviewId,
				params.approvalId,
				body.operationId,
			),
	)
	.post(
		"/:scope/roles/:roleId/activate",
		{
			principalAccess: manage,
			params: RoleParams,
			body: ExecuteAssignmentBody,
			response: { 200: RoleReceipt, ...errors },
			detail: { operationId: "activateAccessRole", tags: ["Access management"] },
		},
		async ({ principalContext, params, body }) =>
			RoleReceipt.parse(
				await executeAssignmentReview(
					principalContext,
					selectors.resolve(params.scope, principalContext.credentialProof(), Date.now()),
					body.reviewId,
					body,
					{ kind: "role", id: params.roleId, operation: "activate" },
				),
			),
	)
	.post(
		"/:scope/roles/:roleId/retire",
		{
			principalAccess: manage,
			params: RoleParams,
			body: ExecuteAssignmentBody,
			response: { 200: RoleReceipt, ...errors },
			detail: { operationId: "retireAccessRole", tags: ["Access management"] },
		},
		async ({ principalContext, params, body }) =>
			RoleReceipt.parse(
				await executeAssignmentReview(
					principalContext,
					selectors.resolve(params.scope, principalContext.credentialProof(), Date.now()),
					body.reviewId,
					body,
					{ kind: "role", id: params.roleId, operation: "retire" },
				),
			),
	)
	.get(
		"/:scope/bindings",
		{
			principalAccess: read,
			params: ScopeParams,
			query: RoleListQuery,
			response: { 200: ManagedBindings, ...errors },
			detail: { operationId: "listAccessRoleBindings", tags: ["Access management"] },
		},
		({ principalContext, params, query }) =>
			listManagedBindings(
				principalContext,
				selectors.resolve(params.scope, principalContext.credentialProof(), Date.now()),
				query.afterId,
			),
	)
	.get(
		"/:scope/bindings/:bindingId",
		{
			principalAccess: read,
			params: BindingParams,
			query: GroupQuery,
			response: { 200: ManagedBinding, ...errors },
			detail: { operationId: "getAccessRoleBinding", tags: ["Access management"] },
		},
		({ principalContext, params, query }) =>
			getManagedBinding(
				principalContext,
				selectors.resolve(params.scope, principalContext.credentialProof(), Date.now()),
				params.bindingId,
				query.version,
			),
	)
	.get(
		"/:scope/bindings/:bindingId/history",
		{
			principalAccess: read,
			params: BindingParams,
			query: RoleHistoryQuery,
			response: { 200: AssignmentHistory, ...errors },
			detail: { operationId: "listAccessRoleBindingHistory", tags: ["Access management"] },
		},
		({ principalContext, params, query }) =>
			listAssignmentHistory(
				principalContext,
				selectors.resolve(params.scope, principalContext.credentialProof(), Date.now()),
				"binding",
				params.bindingId,
				query.afterVersion,
			),
	)
	.put(
		"/:scope/bindings/:bindingId",
		{
			principalAccess: manage,
			params: BindingParams,
			body: ExecuteAssignmentBody,
			response: { 200: BindingReceipt, ...errors },
			detail: { operationId: "createAccessRoleBinding", tags: ["Access management"] },
		},
		async ({ principalContext, params, body }) =>
			BindingReceipt.parse(
				await executeAssignmentReview(
					principalContext,
					selectors.resolve(params.scope, principalContext.credentialProof(), Date.now()),
					body.reviewId,
					body,
					{ kind: "binding", id: params.bindingId, operation: "create" },
				),
			),
	)
	.post(
		"/:scope/bindings/:bindingId/terms",
		{
			principalAccess: manage,
			params: BindingParams,
			body: ExecuteAssignmentBody,
			response: { 200: BindingReceipt, ...errors },
			detail: { operationId: "amendAccessRoleBinding", tags: ["Access management"] },
		},
		async ({ principalContext, params, body }) =>
			BindingReceipt.parse(
				await executeAssignmentReview(
					principalContext,
					selectors.resolve(params.scope, principalContext.credentialProof(), Date.now()),
					body.reviewId,
					body,
					{ kind: "binding", id: params.bindingId, operation: "amend" },
				),
			),
	)
	.post(
		"/:scope/bindings/:bindingId/revoke",
		{
			principalAccess: manage,
			params: BindingParams,
			body: ExecuteAssignmentBody,
			response: { 200: BindingReceipt, ...errors },
			detail: { operationId: "revokeAccessRoleBinding", tags: ["Access management"] },
		},
		async ({ principalContext, params, body }) =>
			BindingReceipt.parse(
				await executeAssignmentReview(
					principalContext,
					selectors.resolve(params.scope, principalContext.credentialProof(), Date.now()),
					body.reviewId,
					body,
					{ kind: "binding", id: params.bindingId, operation: "revoke" },
				),
			),
	)
	.get(
		"/:scope/assignment-ceilings",
		{
			principalAccess: read,
			params: ScopeParams,
			query: RoleListQuery,
			response: { 200: ManagedCeilings, ...errors },
			detail: { operationId: "listAccessAssignmentCeilings", tags: ["Access management"] },
		},
		({ principalContext, params, query }) =>
			listManagedCeilings(
				principalContext,
				selectors.resolve(params.scope, principalContext.credentialProof(), Date.now()),
				query.afterId,
			),
	)
	.get(
		"/:scope/assignment-ceilings/:ceilingId",
		{
			principalAccess: read,
			params: CeilingParams,
			response: { 200: ManagedCeiling, ...errors },
			detail: { operationId: "getAccessAssignmentCeiling", tags: ["Access management"] },
		},
		({ principalContext, params }) =>
			getManagedCeiling(
				principalContext,
				selectors.resolve(params.scope, principalContext.credentialProof(), Date.now()),
				params.ceilingId,
			),
	)
	.get(
		"/:scope/assignment-ceilings/:ceilingId/history",
		{
			principalAccess: read,
			params: CeilingParams,
			query: RoleHistoryQuery,
			response: { 200: AssignmentHistory, ...errors },
			detail: { operationId: "listAccessAssignmentCeilingHistory", tags: ["Access management"] },
		},
		({ principalContext, params, query }) =>
			listAssignmentHistory(
				principalContext,
				selectors.resolve(params.scope, principalContext.credentialProof(), Date.now()),
				"ceiling",
				params.ceilingId,
				query.afterVersion,
			),
	)
	.put(
		"/:scope/assignment-ceilings/:ceilingId",
		{
			principalAccess: manage,
			params: CeilingParams,
			body: ExecuteAssignmentBody,
			response: { 200: CeilingReceipt, ...errors },
			detail: { operationId: "createAccessAssignmentCeiling", tags: ["Access management"] },
		},
		async ({ principalContext, params, body }) =>
			CeilingReceipt.parse(
				await executeAssignmentReview(
					principalContext,
					selectors.resolve(params.scope, principalContext.credentialProof(), Date.now()),
					body.reviewId,
					body,
					{ kind: "ceiling", id: params.ceilingId, operation: "create" },
				),
			),
	)
	.post(
		"/:scope/assignment-ceilings/:ceilingId/revoke",
		{
			principalAccess: manage,
			params: CeilingParams,
			body: ExecuteAssignmentBody,
			response: { 200: CeilingReceipt, ...errors },
			detail: { operationId: "revokeAccessAssignmentCeiling", tags: ["Access management"] },
		},
		async ({ principalContext, params, body }) =>
			CeilingReceipt.parse(
				await executeAssignmentReview(
					principalContext,
					selectors.resolve(params.scope, principalContext.credentialProof(), Date.now()),
					body.reviewId,
					body,
					{ kind: "ceiling", id: params.ceilingId, operation: "revoke" },
				),
			),
	);
