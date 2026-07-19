import { StatusCodes } from "http-status-codes";
import Elysia, { t } from "elysia";

import session from "../../auth/session";
import {
	createEntityAssociationInvitation,
	createEntityAssociationRequest,
	listEntityAssociationProposals,
	resolveEntityAssociationProposal,
} from "../../entities/association-proposals";
import { EntityAssociationProposalExpiryInvalid } from "../../entities/errors";
import { NoContentResponse } from "../schema/action-response";
import { toApiErrorResponse } from "../schema/response";
import {
	CreateEntityAssociationInvitationBody,
	CreateEntityAssociationRequestBody,
	EntityAssociationProposalListResponse,
	EntityAssociationProposalResponse,
	ListEntityAssociationProposalsQuery,
	UnitAssociationProposalActionParams,
	UnitAssociationProposalParams,
} from "./schema";

function futureDate(value: string): Date {
	const date = new Date(value);
	if (date <= new Date()) throw new EntityAssociationProposalExpiryInvalid();
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
	"EntityAssociationProposalNotFound",
]);
const ProposalConflictResponse = toApiErrorResponse([
	"EntityAssociationProposalConflict",
	"EntityAssociationProposalExpired",
]);

export default new Elysia({ prefix: "/unit" })
	.use(session)
	.get(
		"/:unitId/association-proposals",
		async ({ authorization, params, query }) => ({
			items: await listEntityAssociationProposals(authorization, {
				unitId: params.unitId,
				side: query.side,
				kind: query.kind,
				includeResolved: query.includeResolved ?? false,
			}),
		}),
		{
			access: "session-only",
			params: UnitAssociationProposalParams,
			query: ListEntityAssociationProposalsQuery,
			response: {
				[StatusCodes.OK]: EntityAssociationProposalListResponse,
				[StatusCodes.FORBIDDEN]: ProposalForbiddenResponse,
				[StatusCodes.NOT_FOUND]: ProposalNotFoundResponse,
			},
			detail: { summary: "List Unit association proposals", tags: ["Entity"] },
		},
	)
	.post(
		"/:unitId/association-proposals/requests",
		async ({ authorization, profile, params, body }) =>
			createEntityAssociationRequest(authorization, profile.unitId, {
				sourceUnitId: params.unitId,
				targetEntityId: body.targetEntityId,
				kind: body.kind,
				role: body.role,
				expiresAt: futureDate(body.expiresAt),
			}),
		{
			access: "session-only",
			params: UnitAssociationProposalParams,
			body: CreateEntityAssociationRequestBody,
			response: {
				[StatusCodes.OK]: EntityAssociationProposalResponse,
				[StatusCodes.BAD_REQUEST]: toApiErrorResponse([
					"EntityAssociationProposalExpiryInvalid",
				]),
				[StatusCodes.FORBIDDEN]: ProposalForbiddenResponse,
				[StatusCodes.NOT_FOUND]: ProposalNotFoundResponse,
				[StatusCodes.CONFLICT]: ProposalConflictResponse,
			},
			detail: { summary: "Request Entity association", tags: ["Entity"] },
		},
	)
	.post(
		"/:unitId/association-proposals/invitations",
		async ({ authorization, profile, params, body }) =>
			createEntityAssociationInvitation(authorization, profile.unitId, {
				sourceUnitId: body.sourceUnitId,
				targetEntityId: params.unitId,
				kind: body.kind,
				role: body.role,
				expiresAt: futureDate(body.expiresAt),
			}),
		{
			access: "session-only",
			params: UnitAssociationProposalParams,
			body: CreateEntityAssociationInvitationBody,
			response: {
				[StatusCodes.OK]: EntityAssociationProposalResponse,
				[StatusCodes.BAD_REQUEST]: toApiErrorResponse([
					"EntityAssociationProposalExpiryInvalid",
				]),
				[StatusCodes.FORBIDDEN]: ProposalForbiddenResponse,
				[StatusCodes.NOT_FOUND]: ProposalNotFoundResponse,
				[StatusCodes.CONFLICT]: ProposalConflictResponse,
			},
			detail: { summary: "Invite Unit to Entity association", tags: ["Entity"] },
		},
	)
	.post(
		"/:unitId/association-proposals/:proposalId/accept",
		async ({ authorization, profile, params }) =>
			resolveEntityAssociationProposal(authorization, profile.unitId, {
				actingUnitId: params.unitId,
				proposalId: params.proposalId,
				action: "accept",
			}),
		{
			access: "session-only",
			params: UnitAssociationProposalActionParams,
			body: t.Optional(t.Object({}, { additionalProperties: false })),
			response: {
				[StatusCodes.OK]: EntityAssociationProposalResponse,
				[StatusCodes.FORBIDDEN]: ProposalForbiddenResponse,
				[StatusCodes.NOT_FOUND]: ProposalNotFoundResponse,
				[StatusCodes.CONFLICT]: ProposalConflictResponse,
			},
			detail: { summary: "Accept Entity association proposal", tags: ["Entity"] },
		},
	)
	.post(
		"/:unitId/association-proposals/:proposalId/decline",
		async ({ authorization, profile, params }) =>
			resolveEntityAssociationProposal(authorization, profile.unitId, {
				actingUnitId: params.unitId,
				proposalId: params.proposalId,
				action: "decline",
			}),
		{
			access: "session-only",
			params: UnitAssociationProposalActionParams,
			body: t.Optional(t.Object({}, { additionalProperties: false })),
			response: {
				[StatusCodes.OK]: EntityAssociationProposalResponse,
				[StatusCodes.FORBIDDEN]: ProposalForbiddenResponse,
				[StatusCodes.NOT_FOUND]: ProposalNotFoundResponse,
				[StatusCodes.CONFLICT]: ProposalConflictResponse,
			},
			detail: { summary: "Decline Entity association proposal", tags: ["Entity"] },
		},
	)
	.delete(
		"/:unitId/association-proposals/:proposalId",
		async ({ authorization, profile, params }) => {
			await resolveEntityAssociationProposal(authorization, profile.unitId, {
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
				summary: "Cancel Entity association proposal",
				tags: ["Entity"],
				responses: NoContentResponse,
			},
		},
	);
