import { StatusCodes } from "http-status-codes";
import Elysia, { t } from "elysia";

import session from "../../auth/session";
import {
	acceptUnitAccessInvitation,
	cancelUnitAccessInvitation,
	createUnitAccessInvitation,
	declineUnitAccessInvitation,
	listManagedUnitAccessInvitations,
	listReceivedUnitAccessInvitations,
} from "../../authorization/unit/invitations";
import { NoContentResponse } from "../schema/action-response";
import { toApiErrorResponse } from "../schema/response";
import { UnitAccessExpiryInvalid } from "./errors";
import {
	CreateUnitAccessInvitationBody,
	ListUnitAccessInvitationsQuery,
	UnitAccessInvitationListResponse,
	UnitAccessInvitationParams,
	UnitAccessInvitationResponse,
	UnitGovernanceParams,
} from "./schema";

function futureDate(value: string): Date {
	const date = new Date(value);
	if (date <= new Date()) throw new UnitAccessExpiryInvalid();
	return date;
}

const InvitationForbiddenResponse = toApiErrorResponse([
	"UnitPermissionForbidden",
	"UnitAccessRestricted",
	"UnitProtected",
	"UnitAccessRoleDelegationForbidden",
]);
const InvitationConflictResponse = toApiErrorResponse([
	"UnitAccessInvitationConflict",
	"UnitAccessInvitationExpired",
	"UnitAccessBindingConflict",
]);

export default new Elysia({ prefix: "/unit" })
	.use(session)
	.get(
		"/access-invitations",
		async ({ profile, query }) => ({
			items: await listReceivedUnitAccessInvitations(
				profile.unitId,
				query.includeResolved ?? false,
			),
		}),
		{
			access: "session-only",
			query: ListUnitAccessInvitationsQuery,
			response: { [StatusCodes.OK]: UnitAccessInvitationListResponse },
			detail: { summary: "List received Unit access invitations", tags: ["Governance"] },
		},
	)
	.get(
		"/:unitId/access-invitations",
		async ({ authorization, params, query }) => ({
			items: await listManagedUnitAccessInvitations(
				authorization.unit,
				params.unitId,
				query.includeResolved ?? false,
			),
		}),
		{
			access: "session-only",
			params: UnitGovernanceParams,
			query: ListUnitAccessInvitationsQuery,
			response: {
				[StatusCodes.OK]: UnitAccessInvitationListResponse,
				[StatusCodes.FORBIDDEN]: InvitationForbiddenResponse,
				[StatusCodes.NOT_FOUND]: toApiErrorResponse(["UnitNotFound"]),
			},
			detail: { summary: "List managed Unit access invitations", tags: ["Governance"] },
		},
	)
	.post(
		"/:unitId/access-invitations",
		async ({ authorization, profile, params, body }) =>
			createUnitAccessInvitation(authorization.unit, profile.unitId, {
				unitId: params.unitId,
				invitedProfileId: body.invitedProfileId,
				role: body.role,
				scope: body.scope,
				expiresAt: futureDate(body.invitationExpiresAt),
				accessExpiresAt: body.accessExpiresAt ? futureDate(body.accessExpiresAt) : null,
			}),
		{
			access: "session-only",
			params: UnitGovernanceParams,
			body: CreateUnitAccessInvitationBody,
			response: {
				[StatusCodes.OK]: UnitAccessInvitationResponse,
				[StatusCodes.BAD_REQUEST]: toApiErrorResponse([
					"UnitAccessExpiryInvalid",
					"UnitAccessInvitationSelfForbidden",
				]),
				[StatusCodes.FORBIDDEN]: InvitationForbiddenResponse,
				[StatusCodes.NOT_FOUND]: toApiErrorResponse(["UnitNotFound", "ProfileNotFound"]),
				[StatusCodes.CONFLICT]: InvitationConflictResponse,
			},
			detail: { summary: "Create Unit access invitation", tags: ["Governance"] },
		},
	)
	.post(
		"/:unitId/access-invitations/:invitationId/accept",
		async ({ profile, params }) =>
			(await acceptUnitAccessInvitation(profile.unitId, params.unitId, params.invitationId))
				.invitation,
		{
			access: "session-only",
			params: UnitAccessInvitationParams,
			body: t.Optional(t.Object({}, { additionalProperties: false })),
			response: {
				[StatusCodes.OK]: UnitAccessInvitationResponse,
				[StatusCodes.NOT_FOUND]: toApiErrorResponse(["UnitAccessInvitationNotFound"]),
				[StatusCodes.CONFLICT]: InvitationConflictResponse,
			},
			detail: { summary: "Accept Unit access invitation", tags: ["Governance"] },
		},
	)
	.post(
		"/:unitId/access-invitations/:invitationId/decline",
		async ({ profile, params }) =>
			declineUnitAccessInvitation(profile.unitId, params.unitId, params.invitationId),
		{
			access: "session-only",
			params: UnitAccessInvitationParams,
			body: t.Optional(t.Object({}, { additionalProperties: false })),
			response: {
				[StatusCodes.OK]: UnitAccessInvitationResponse,
				[StatusCodes.NOT_FOUND]: toApiErrorResponse(["UnitAccessInvitationNotFound"]),
				[StatusCodes.CONFLICT]: InvitationConflictResponse,
			},
			detail: { summary: "Decline Unit access invitation", tags: ["Governance"] },
		},
	)
	.delete(
		"/:unitId/access-invitations/:invitationId",
		async ({ authorization, profile, params }) => {
			await cancelUnitAccessInvitation(
				authorization.unit,
				profile.unitId,
				params.unitId,
				params.invitationId,
			);
			return new Response(null, { status: StatusCodes.NO_CONTENT });
		},
		{
			access: "session-only",
			params: UnitAccessInvitationParams,
			response: {
				[StatusCodes.NO_CONTENT]: t.Void(),
				[StatusCodes.FORBIDDEN]: InvitationForbiddenResponse,
				[StatusCodes.NOT_FOUND]: toApiErrorResponse([
					"UnitNotFound",
					"UnitAccessInvitationNotFound",
				]),
				[StatusCodes.CONFLICT]: InvitationConflictResponse,
			},
			detail: {
				summary: "Cancel Unit access invitation",
				tags: ["Governance"],
				responses: NoContentResponse,
			},
		},
	);
