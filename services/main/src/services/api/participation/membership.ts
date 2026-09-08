import Elysia from "elysia";
import { z } from "zod";
import session from "../../auth/session";
import { runParticipationTransaction } from "../../participation/transaction";
import {
	CreateMembershipInvitationSchema,
	MembershipExpectedRevisionSchema,
	MembershipInvitationPageSchema,
	MembershipInvitationSchema,
	MembershipPageQuerySchema,
	OrganizationMemberPageSchema,
	OrganizationMemberSchema,
} from "../../participation/membership-contracts";
import {
	acceptMembershipInvitation,
	cancelMembershipInvitation,
	declineMembershipInvitation,
	inviteOrganizationMember,
	leaveOrganization,
	listOrganizationMembers,
	listOrganizationMembershipInvitations,
	listOwnMembershipInvitations,
	listOwnOrganizationMemberships,
	removeOrganizationMember,
} from "../../participation/membership";
import { toApiErrorResponse } from "../schema/response";

const organizationParams = z.strictObject({ organizationEntityId: z.uuid() });
const invitationParams = z.strictObject({ invitationId: z.uuid() });
const failures = {
	403: toApiErrorResponse(["ParticipationDenied"]),
	404: toApiErrorResponse(["OrganizationMembershipNotFound"]),
	409: toApiErrorResponse([
		"OrganizationMembershipConflict",
		"OrganizationMembershipCapacityExceeded",
	]),
};

/** Human operational membership; accepting never issues representation or security grants. @alpha */
export default new Elysia({ prefix: "/membership", name: "organization-membership-api" })
	.use(session)
	.get(
		"/organizations/:organizationEntityId/members",
		{
			access: "session-only",
			params: organizationParams,
			query: MembershipPageQuerySchema,
			response: { 200: OrganizationMemberPageSchema, ...failures },
			detail: { operationId: "listManagedOrganizationMembers", tags: ["Participation"] },
		},
		({ participation, params, query }) =>
			runParticipationTransaction((tx) =>
				listOrganizationMembers(tx, participation, params.organizationEntityId, query),
			),
	)
	.get(
		"/organizations/:organizationEntityId/invitations",
		{
			access: "session-only",
			params: organizationParams,
			query: MembershipPageQuerySchema,
			response: { 200: MembershipInvitationPageSchema, ...failures },
			detail: { operationId: "listManagedOrganizationInvitations", tags: ["Participation"] },
		},
		({ participation, params, query }) =>
			runParticipationTransaction((tx) =>
				listOrganizationMembershipInvitations(
					tx,
					participation,
					params.organizationEntityId,
					query,
				),
			),
	)
	.post(
		"/organizations/:organizationEntityId/invitations",
		{
			access: "session-only",
			params: organizationParams,
			body: CreateMembershipInvitationSchema,
			response: { 200: MembershipInvitationSchema, ...failures },
			detail: { operationId: "inviteOrganizationMember", tags: ["Participation"] },
		},
		({ participation, params, body }) =>
			runParticipationTransaction((tx) =>
				inviteOrganizationMember(tx, participation, params.organizationEntityId, body),
			),
	)
	.post(
		"/organizations/:organizationEntityId/invitations/:invitationId/cancel",
		{
			access: "session-only",
			params: organizationParams.merge(invitationParams),
			body: MembershipExpectedRevisionSchema,
			response: { 200: MembershipInvitationSchema, ...failures },
			detail: { operationId: "cancelOrganizationMembershipInvitation", tags: ["Participation"] },
		},
		({ participation, params, body }) =>
			runParticipationTransaction((tx) =>
				cancelMembershipInvitation(
					tx,
					participation,
					params.organizationEntityId,
					params.invitationId,
					body.expectedRevision,
				),
			),
	)
	.post(
		"/organizations/:organizationEntityId/members/:memberEntityId/remove",
		{
			access: "session-only",
			params: organizationParams.extend({ memberEntityId: z.uuid() }),
			body: MembershipExpectedRevisionSchema,
			response: { 200: OrganizationMemberSchema, ...failures },
			detail: { operationId: "removeOrganizationMember", tags: ["Participation"] },
		},
		({ participation, params, body }) =>
			runParticipationTransaction((tx) =>
				removeOrganizationMember(
					tx,
					participation,
					params.organizationEntityId,
					params.memberEntityId,
					body.expectedRevision,
				),
			),
	)
	.get(
		"/me/invitations",
		{
			access: "session-only",
			query: MembershipPageQuerySchema,
			response: { 200: MembershipInvitationPageSchema, ...failures },
			detail: { operationId: "listOwnOrganizationMembershipInvitations", tags: ["Participation"] },
		},
		({ participation, query }) =>
			runParticipationTransaction((tx) => listOwnMembershipInvitations(tx, participation, query)),
	)
	.get(
		"/me/organizations",
		{
			access: "session-only",
			query: MembershipPageQuerySchema,
			response: { 200: OrganizationMemberPageSchema, ...failures },
			detail: { operationId: "listOwnOrganizationMemberships", tags: ["Participation"] },
		},
		({ participation, query }) =>
			runParticipationTransaction((tx) => listOwnOrganizationMemberships(tx, participation, query)),
	)
	.post(
		"/invitations/:invitationId/accept",
		{
			access: "session-only",
			params: invitationParams,
			body: MembershipExpectedRevisionSchema,
			response: { 200: MembershipInvitationSchema, ...failures },
			detail: { operationId: "acceptOrganizationMembershipInvitation", tags: ["Participation"] },
		},
		({ participation, params, body }) =>
			runParticipationTransaction((tx) =>
				acceptMembershipInvitation(tx, participation, params.invitationId, body.expectedRevision),
			),
	)
	.post(
		"/invitations/:invitationId/decline",
		{
			access: "session-only",
			params: invitationParams,
			body: MembershipExpectedRevisionSchema,
			response: { 200: MembershipInvitationSchema, ...failures },
			detail: { operationId: "declineOrganizationMembershipInvitation", tags: ["Participation"] },
		},
		({ participation, params, body }) =>
			runParticipationTransaction((tx) =>
				declineMembershipInvitation(tx, participation, params.invitationId, body.expectedRevision),
			),
	)
	.post(
		"/me/organizations/:organizationEntityId/leave",
		{
			access: "session-only",
			params: organizationParams,
			body: MembershipExpectedRevisionSchema,
			response: { 200: OrganizationMemberSchema, ...failures },
			detail: { operationId: "leaveOrganizationMembership", tags: ["Participation"] },
		},
		({ participation, params, body }) =>
			runParticipationTransaction((tx) =>
				leaveOrganization(tx, participation, params.organizationEntityId, body.expectedRevision),
			),
	);
