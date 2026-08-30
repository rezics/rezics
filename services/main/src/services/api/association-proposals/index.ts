import { StatusCodes } from "http-status-codes";
import Elysia, { t } from "elysia";

import session from "../../auth/session";
import {
	isCreditAttributionRole,
	isSubjectAssociationRole,
} from "../../database/schema/contract-values";
import {
	createAssociationInvitation,
	createAssociationRequest,
	listAssociationProposals,
	resolveAssociationProposal,
} from "../../units/association-proposals";
import {
	AssociationProposalExpiryInvalid,
	AssociationProposalRoleInvalid,
} from "../../units/errors";
import { NoContentResponse } from "../schema/action-response";
import { toApiErrorResponse } from "../schema/response";
import {
	CreateAssociationInvitationBody,
	CreateAssociationRequestBody,
	AssociationProposalListResponse,
	AssociationProposalResponse,
	ListAssociationProposalsQuery,
	UnitAssociationProposalActionParams,
	UnitAssociationProposalParams,
	ResolveAssociationProposalBody,
} from "./schema";

function futureDate(value: string): Date {
	const date = new Date(value);
	if (date <= new Date()) throw new AssociationProposalExpiryInvalid();
	return date;
}

const ProposalForbiddenResponse = toApiErrorResponse([
	"UnitPermissionForbidden",
	"UnitAccessRestricted",
	"EntityAssociationRestricted",
]);
const ProposalNotFoundResponse = toApiErrorResponse([
	"UnitNotFound",
	"EntityEntryNotFound",
	"AssociationProposalNotFound",
]);
const ProposalConflictResponse = toApiErrorResponse([
	"AssociationProposalConflict",
	"AssociationProposalExpired",
]);

export default new Elysia({ prefix: "/unit" })
	.use(session)
	.get(
		"/:unitId/association-proposals",
		{
			access: "session-only",
			params: UnitAssociationProposalParams,
			query: ListAssociationProposalsQuery,
			response: {
				[StatusCodes.OK]: AssociationProposalListResponse,
				[StatusCodes.FORBIDDEN]: ProposalForbiddenResponse,
				[StatusCodes.NOT_FOUND]: ProposalNotFoundResponse,
			},
			detail: { summary: "List Unit association proposals", tags: ["Unit"] },
		},
		async ({ authorization, params, query }) => ({
			items: await listAssociationProposals(authorization, {
				unitId: params.unitId,
				side: query.side,
				kind: query.kind,
				includeResolved: query.includeResolved ?? false,
			}),
		}),
	)
	.post(
		"/:unitId/association-proposals/requests",
		{
			access: "session-only",
			params: UnitAssociationProposalParams,
			body: CreateAssociationRequestBody,
			response: {
				[StatusCodes.OK]: AssociationProposalResponse,
				[StatusCodes.BAD_REQUEST]: toApiErrorResponse([
					"AssociationProposalExpiryInvalid",
					"AssociationProposalRoleInvalid",
					"AssociationContextPostInvalid",
				]),
				[StatusCodes.FORBIDDEN]: ProposalForbiddenResponse,
				[StatusCodes.NOT_FOUND]: ProposalNotFoundResponse,
				[StatusCodes.CONFLICT]: ProposalConflictResponse,
			},
			detail: { summary: "Request Unit association", tags: ["Unit"] },
		},
		async ({ authorization, profile, params, body }) => {
			const common = {
				sourceUnitId: params.unitId,
				targetUnitId: body.targetUnitId,
				expiresAt: futureDate(body.expiresAt),
			};
			if (body.kind === "credit") {
				if (!isCreditAttributionRole(body.role)) throw new AssociationProposalRoleInvalid();
				return createAssociationRequest(authorization, profile.unitId, {
					...common,
					kind: body.kind,
					role: body.role,
				});
			}
			if (!isSubjectAssociationRole(body.role)) throw new AssociationProposalRoleInvalid();
			return createAssociationRequest(authorization, profile.unitId, {
				...common,
				kind: body.kind,
				role: body.role,
				...(body.contextPostId ? { contextPostId: body.contextPostId } : {}),
			});
		},
	)
	.post(
		"/:unitId/association-proposals/invitations",
		{
			access: "session-only",
			params: UnitAssociationProposalParams,
			body: CreateAssociationInvitationBody,
			response: {
				[StatusCodes.OK]: AssociationProposalResponse,
				[StatusCodes.BAD_REQUEST]: toApiErrorResponse([
					"AssociationProposalExpiryInvalid",
					"AssociationProposalRoleInvalid",
					"AssociationContextPostInvalid",
				]),
				[StatusCodes.FORBIDDEN]: ProposalForbiddenResponse,
				[StatusCodes.NOT_FOUND]: ProposalNotFoundResponse,
				[StatusCodes.CONFLICT]: ProposalConflictResponse,
			},
			detail: { summary: "Invite Unit to association", tags: ["Unit"] },
		},
		async ({ authorization, profile, params, body }) => {
			const common = {
				sourceUnitId: body.sourceUnitId,
				targetUnitId: params.unitId,
				expiresAt: futureDate(body.expiresAt),
			};
			if (body.kind === "credit") {
				if (!isCreditAttributionRole(body.role)) throw new AssociationProposalRoleInvalid();
				return createAssociationInvitation(authorization, profile.unitId, {
					...common,
					kind: body.kind,
					role: body.role,
				});
			}
			if (!isSubjectAssociationRole(body.role)) throw new AssociationProposalRoleInvalid();
			return createAssociationInvitation(authorization, profile.unitId, {
				...common,
				kind: body.kind,
				role: body.role,
				...(body.contextPostId ? { contextPostId: body.contextPostId } : {}),
			});
		},
	)
	.post(
		"/:unitId/association-proposals/:proposalId/accept",
		{
			access: "session-only",
			params: UnitAssociationProposalActionParams,
			body: ResolveAssociationProposalBody,
			response: {
				[StatusCodes.OK]: AssociationProposalResponse,
				[StatusCodes.FORBIDDEN]: ProposalForbiddenResponse,
				[StatusCodes.NOT_FOUND]: ProposalNotFoundResponse,
				[StatusCodes.CONFLICT]: ProposalConflictResponse,
				[StatusCodes.BAD_REQUEST]: toApiErrorResponse([
					"RevisionCreditEntityInvalid",
					"RevisionContributionActorRequired",
				]),
			},
			detail: { summary: "Accept Unit association proposal", tags: ["Unit"] },
		},
		async ({ authorization, profile, params, body }) =>
			resolveAssociationProposal(authorization, profile.unitId, {
				actingUnitId: params.unitId,
				proposalId: params.proposalId,
				action: "accept",
				contribution: body?.revisionContext?.contribution,
			}),
	)
	.post(
		"/:unitId/association-proposals/:proposalId/decline",
		{
			access: "session-only",
			params: UnitAssociationProposalActionParams,
			body: t.Optional(t.Object({}, { additionalProperties: false })),
			response: {
				[StatusCodes.OK]: AssociationProposalResponse,
				[StatusCodes.FORBIDDEN]: ProposalForbiddenResponse,
				[StatusCodes.NOT_FOUND]: ProposalNotFoundResponse,
				[StatusCodes.CONFLICT]: ProposalConflictResponse,
			},
			detail: { summary: "Decline Unit association proposal", tags: ["Unit"] },
		},
		async ({ authorization, profile, params }) =>
			resolveAssociationProposal(authorization, profile.unitId, {
				actingUnitId: params.unitId,
				proposalId: params.proposalId,
				action: "decline",
			}),
	)
	.delete(
		"/:unitId/association-proposals/:proposalId",
		{
			access: "session-only",
			params: UnitAssociationProposalActionParams,
			response: {
				[StatusCodes.NO_CONTENT]: t.Void(),
				[StatusCodes.FORBIDDEN]: ProposalForbiddenResponse,
				[StatusCodes.NOT_FOUND]: ProposalNotFoundResponse,
				[StatusCodes.CONFLICT]: ProposalConflictResponse,
			},
			detail: {
				summary: "Cancel Unit association proposal",
				tags: ["Unit"],
				responses: NoContentResponse,
			},
		},
		async ({ authorization, profile, params }) => {
			await resolveAssociationProposal(authorization, profile.unitId, {
				actingUnitId: params.unitId,
				proposalId: params.proposalId,
				action: "cancel",
			});
			return new Response(null, { status: StatusCodes.NO_CONTENT });
		},
	);
