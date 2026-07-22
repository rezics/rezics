import { StatusCodes } from "http-status-codes";
import Elysia, { t } from "elysia";

import session from "../../auth/session";
import {
	createAssociationInvitation,
	createAssociationRequest,
	listAssociationProposals,
	resolveAssociationProposal,
} from "../../units/association-proposals";
import { AssociationProposalExpiryInvalid } from "../../units/errors";
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
} from "./schema";

function futureDate(value: string): Date {
	const date = new Date(value);
	if (date <= new Date()) throw new AssociationProposalExpiryInvalid();
	return date;
}

const ProposalForbiddenResponse = toApiErrorResponse([
	"UnitPermissionForbidden",
	"UnitAccessRestricted",
	"UnitProtected",
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
		async ({ authorization, params, query }) => ({
			items: await listAssociationProposals(authorization, {
				unitId: params.unitId,
				side: query.side,
				kind: query.kind,
				includeResolved: query.includeResolved ?? false,
			}),
		}),
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
	)
	.post(
		"/:unitId/association-proposals/requests",
		async ({ authorization, profile, params, body }) =>
			createAssociationRequest(authorization, profile.unitId, {
				sourceUnitId: params.unitId,
				targetUnitId: body.targetUnitId,
				kind: body.kind,
				role: body.role,
				expiresAt: futureDate(body.expiresAt),
			}),
		{
			access: "session-only",
			params: UnitAssociationProposalParams,
			body: CreateAssociationRequestBody,
			response: {
				[StatusCodes.OK]: AssociationProposalResponse,
				[StatusCodes.BAD_REQUEST]: toApiErrorResponse(["AssociationProposalExpiryInvalid"]),
				[StatusCodes.FORBIDDEN]: ProposalForbiddenResponse,
				[StatusCodes.NOT_FOUND]: ProposalNotFoundResponse,
				[StatusCodes.CONFLICT]: ProposalConflictResponse,
			},
			detail: { summary: "Request Unit association", tags: ["Unit"] },
		},
	)
	.post(
		"/:unitId/association-proposals/invitations",
		async ({ authorization, profile, params, body }) =>
			createAssociationInvitation(authorization, profile.unitId, {
				sourceUnitId: body.sourceUnitId,
				targetUnitId: params.unitId,
				kind: body.kind,
				role: body.role,
				expiresAt: futureDate(body.expiresAt),
			}),
		{
			access: "session-only",
			params: UnitAssociationProposalParams,
			body: CreateAssociationInvitationBody,
			response: {
				[StatusCodes.OK]: AssociationProposalResponse,
				[StatusCodes.BAD_REQUEST]: toApiErrorResponse(["AssociationProposalExpiryInvalid"]),
				[StatusCodes.FORBIDDEN]: ProposalForbiddenResponse,
				[StatusCodes.NOT_FOUND]: ProposalNotFoundResponse,
				[StatusCodes.CONFLICT]: ProposalConflictResponse,
			},
			detail: { summary: "Invite Unit to association", tags: ["Unit"] },
		},
	)
	.post(
		"/:unitId/association-proposals/:proposalId/accept",
		async ({ authorization, profile, params }) =>
			resolveAssociationProposal(authorization, profile.unitId, {
				actingUnitId: params.unitId,
				proposalId: params.proposalId,
				action: "accept",
			}),
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
			detail: { summary: "Accept Unit association proposal", tags: ["Unit"] },
		},
	)
	.post(
		"/:unitId/association-proposals/:proposalId/decline",
		async ({ authorization, profile, params }) =>
			resolveAssociationProposal(authorization, profile.unitId, {
				actingUnitId: params.unitId,
				proposalId: params.proposalId,
				action: "decline",
			}),
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
	)
	.delete(
		"/:unitId/association-proposals/:proposalId",
		async ({ authorization, profile, params }) => {
			await resolveAssociationProposal(authorization, profile.unitId, {
				actingUnitId: params.unitId,
				proposalId: params.proposalId,
				action: "cancel",
			});
			return new Response(null, { status: StatusCodes.NO_CONTENT });
		},
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
	);
