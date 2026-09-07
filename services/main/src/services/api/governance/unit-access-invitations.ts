import Elysia, { t } from "elysia";
import { StatusCodes } from "http-status-codes";

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
]);
const InvitationConflictResponse = toApiErrorResponse([
	"UnitAccessInvitationConflict",
	"UnitAccessInvitationExpired",
]);

export default new Elysia({ prefix: "/unit" })
	.use(session)
	.get(
		"/access-invitations",
		{
			access: "session-only",
			query: ListUnitAccessInvitationsQuery,
			response: { [StatusCodes.OK]: UnitAccessInvitationListResponse },
			detail: { summary: "List received Unit access invitations", tags: ["Governance"] },
		},
		async ({ user, query }) => ({
			items: await listReceivedUnitAccessInvitations(user.id, query.includeResolved ?? false),
		}),
	)
	.get(
		"/:unitId/access-invitations",
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
		async ({ authorization, params, query }) => ({
			items: await listManagedUnitAccessInvitations(
				authorization.unit,
				params.unitId,
				query.includeResolved ?? false,
			),
		}),
	)
	.post(
		"/:unitId/access-invitations",
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
		async ({ authorization, user, params, body }) => {
			const result = await createUnitAccessInvitation(authorization.unit, user.id, {
				unitId: params.unitId,
				invitedAuthUserId: body.invitedAuthUserId,
				permissions: body.permissions,
				scope: body.scope,
				expiresAt: futureDate(body.invitationExpiresAt),
				accessExpiresAt: body.accessExpiresAt ? futureDate(body.accessExpiresAt) : null,
			});
			return result.invitation;
		},
	)
	.post(
		"/:unitId/access-invitations/:invitationId/accept",
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
		async ({ user, params }) =>
			(await acceptUnitAccessInvitation(user.id, params.unitId, params.invitationId)).invitation,
	)
	.post(
		"/:unitId/access-invitations/:invitationId/decline",
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
		async ({ user, params }) =>
			declineUnitAccessInvitation(user.id, params.unitId, params.invitationId),
	)
	.delete(
		"/:unitId/access-invitations/:invitationId",
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
		async ({ authorization, user, params }) => {
			await cancelUnitAccessInvitation(
				authorization.unit,
				user.id,
				params.unitId,
				params.invitationId,
			);
			return new Response(null, { status: StatusCodes.NO_CONTENT });
		},
	);
