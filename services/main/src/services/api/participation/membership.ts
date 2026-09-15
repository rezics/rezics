import {
	listMembershipManagedOrganizations,
	MembershipOrganizationDirectorySchema,
} from "../../participation/membership-directory";
import { createNativeOrganization } from "../../participation/organization-control";
import {
	RecoverNativeOrganizationSchema,
	recoverNativeOrganization,
	selectOrganizationRecoveryRecipient,
} from "../../participation/organization-recovery";
import { CreateManagedOrganizationSchema } from "../../participation/organizations";
import Elysia from "elysia";
import { z } from "zod";
import principalSession from "../../auth/principal-session";
import { runAccessTransaction } from "../../authorization/transaction";
import { toApiErrorResponse } from "../schema/response";
import {
	AcceptMembershipInvitationSchema,
	CreateMembershipInvitationSchema,
	MembershipContactSchema,
	MembershipDepartureSchema,
	MembershipExpectedRevisionSchema,
	MembershipHistoryQuerySchema,
	MembershipHistorySchema,
	MembershipInvitationPageSchema,
	MembershipPageQuerySchema,
	MembershipReceiptSchema,
	MembershipRecipientSchema,
	OrganizationMemberPageSchema,
	RemoveMembershipSchema,
} from "../../participation/membership-contracts";
import {
	acceptMembershipInvitation,
	cancelMembershipInvitation,
	createOrganizationEnrollmentContact,
	declineMembershipInvitation,
	inviteOrganizationMember,
	leaveOrganization,
	listOrganizationMembers,
	listOrganizationMembershipHistory,
	listOrganizationMembershipInvitations,
	listOwnMembershipInvitations,
	listOwnOrganizationMemberships,
	removeOrganizationMember,
	resolveOrganizationEnrollmentContact,
	revokeOrganizationEnrollmentContact,
} from "../../participation/membership";
const org = z.strictObject({ organizationEntityId: z.uuid() }),
	invitation = z.strictObject({ invitationId: z.uuid() });
const read = { permission: "access:read", fresh: false, write: false } as const;
const write = { permission: "access:manage", fresh: true, write: true } as const;
const failures = {
	403: toApiErrorResponse(["AccessDenied"]),
	404: toApiErrorResponse(["AccessRecordUnavailable", "OrganizationMembershipNotFound"]),
	409: toApiErrorResponse([
		"AccessChanged",
		"OrganizationMembershipConflict",
		"OrganizationMembershipCapacityExceeded",
	]),
	503: toApiErrorResponse(["AccessUnavailable"]),
};
/** Org native enrollment for explicitly consenting private principals and represented Entities. @alpha */
export default new Elysia({ prefix: "/membership", name: "organization-membership-api" })
	.use(principalSession)
	.get(
		"/managed-organizations",
		{
			principalAccess: read,
			query: MembershipPageQuerySchema,
			response: { 200: MembershipOrganizationDirectorySchema, ...failures },
			detail: { operationId: "listMembershipManagedOrganizations", tags: ["Participation"] },
		},
		({ principalContext, query }) =>
			runAccessTransaction((tx) =>
				listMembershipManagedOrganizations(tx, principalContext, query.afterId),
			),
	)
	.post(
		"/organizations",
		{
			principalAccess: { permission: "account:update", fresh: true, write: true },
			body: CreateManagedOrganizationSchema,
			response: {
				200: z.strictObject({
					entityId: z.uuid(),
					scopeId: z.uuid(),
					representation: z.strictObject({ id: z.uuid(), revision: z.number().int().positive() }),
				}),
				...failures,
			},
			detail: { operationId: "createNativeOrganization", tags: ["Participation"] },
		},
		({ principalContext, body }) => createNativeOrganization(principalContext, body),
	)
	.post(
		"/organizations/:organizationEntityId/recovery-recipient",
		{
			principalAccess: write,
			params: org,
			body: z.strictObject({ contact: z.string().regex(/^[A-Za-z0-9_-]{43}$/) }),
			response: {
				200: z.strictObject({ selector: z.string(), expiresAt: z.iso.datetime() }),
				...failures,
			},
			detail: { operationId: "selectOrganizationRecoveryRecipient", tags: ["Participation"] },
		},
		({ principalContext, params, body }) =>
			selectOrganizationRecoveryRecipient(
				principalContext,
				params.organizationEntityId,
				body.contact,
			),
	)
	.post(
		"/organizations/:organizationEntityId/recover",
		{
			principalAccess: write,
			params: org,
			body: RecoverNativeOrganizationSchema,
			response: {
				200: z.strictObject({
					entityId: z.uuid(),
					revision: z.number().int().positive(),
					scopeId: z.uuid(),
					representation: z.strictObject({ id: z.uuid(), revision: z.number().int().positive() }),
				}),
				...failures,
			},
			detail: { operationId: "recoverNativeOrganization", tags: ["Participation"] },
		},
		({ principalContext, params, body }) =>
			recoverNativeOrganization(principalContext, params.organizationEntityId, body),
	)
	.get(
		"/organizations/:organizationEntityId/members",
		{
			principalAccess: read,
			params: org,
			query: MembershipPageQuerySchema,
			response: { 200: OrganizationMemberPageSchema, ...failures },
			detail: { operationId: "listManagedOrganizationMembers", tags: ["Participation"] },
		},
		({ principalContext, params, query }) =>
			runAccessTransaction((tx) =>
				listOrganizationMembers(tx, principalContext, params.organizationEntityId, query),
			),
	)
	.post(
		"/organizations/:organizationEntityId/history",
		{
			principalAccess: read,
			params: org,
			body: MembershipHistoryQuerySchema,
			response: { 200: MembershipHistorySchema, ...failures },
			detail: { operationId: "listOrganizationMembershipHistory", tags: ["Participation"] },
		},
		({ principalContext, params, body }) =>
			runAccessTransaction((tx) =>
				listOrganizationMembershipHistory(
					tx,
					principalContext,
					params.organizationEntityId,
					body.recipient,
					body.afterVersion,
				),
			),
	)
	.get(
		"/organizations/:organizationEntityId/invitations",
		{
			principalAccess: read,
			params: org,
			query: MembershipPageQuerySchema,
			response: { 200: MembershipInvitationPageSchema, ...failures },
			detail: { operationId: "listManagedOrganizationInvitations", tags: ["Participation"] },
		},
		({ principalContext, params, query }) =>
			runAccessTransaction((tx) =>
				listOrganizationMembershipInvitations(
					tx,
					principalContext,
					params.organizationEntityId,
					query,
				),
			),
	)
	.post(
		"/organizations/:organizationEntityId/invitations",
		{
			principalAccess: write,
			params: org,
			body: CreateMembershipInvitationSchema,
			response: { 200: MembershipReceiptSchema, ...failures },
			detail: { operationId: "inviteOrganizationMember", tags: ["Participation"] },
		},
		({ principalContext, params, body }) =>
			runAccessTransaction((tx) =>
				inviteOrganizationMember(tx, principalContext, params.organizationEntityId, body),
			),
	)
	.post(
		"/organizations/:organizationEntityId/invitations/:invitationId/revoke",
		{
			principalAccess: write,
			params: org.merge(invitation),
			body: MembershipExpectedRevisionSchema,
			response: { 200: MembershipReceiptSchema, ...failures },
			detail: { operationId: "revokeOrganizationMembershipInvitation", tags: ["Participation"] },
		},
		({ principalContext, params, body }) =>
			runAccessTransaction((tx) =>
				cancelMembershipInvitation(
					tx,
					principalContext,
					params.organizationEntityId,
					params.invitationId,
					body,
				),
			),
	)
	.post(
		"/organizations/:organizationEntityId/members/remove",
		{
			principalAccess: write,
			params: org,
			body: RemoveMembershipSchema,
			response: { 200: MembershipReceiptSchema, ...failures },
			detail: { operationId: "removeOrganizationMember", tags: ["Participation"] },
		},
		({ principalContext, params, body }) =>
			runAccessTransaction((tx) =>
				removeOrganizationMember(tx, principalContext, params.organizationEntityId, body),
			),
	)
	.get(
		"/me/invitations",
		{
			principalAccess: read,
			query: MembershipPageQuerySchema,
			response: { 200: MembershipInvitationPageSchema, ...failures },
			detail: { operationId: "listOwnOrganizationMembershipInvitations", tags: ["Participation"] },
		},
		({ principalContext, query }) =>
			runAccessTransaction((tx) => listOwnMembershipInvitations(tx, principalContext, query)),
	)
	.get(
		"/me/organizations",
		{
			principalAccess: read,
			query: MembershipPageQuerySchema,
			response: { 200: OrganizationMemberPageSchema, ...failures },
			detail: { operationId: "listOwnOrganizationMemberships", tags: ["Participation"] },
		},
		({ principalContext, query }) =>
			runAccessTransaction((tx) => listOwnOrganizationMemberships(tx, principalContext, query)),
	)
	.post(
		"/invitations/:invitationId/accept",
		{
			principalAccess: write,
			params: invitation,
			body: AcceptMembershipInvitationSchema,
			response: { 200: MembershipReceiptSchema, ...failures },
			detail: { operationId: "acceptOrganizationMembershipInvitation", tags: ["Participation"] },
		},
		({ principalContext, params, body }) =>
			runAccessTransaction((tx) =>
				acceptMembershipInvitation(tx, principalContext, params.invitationId, body),
			),
	)
	.post(
		"/invitations/:invitationId/decline",
		{
			principalAccess: write,
			params: invitation,
			body: MembershipExpectedRevisionSchema,
			response: { 200: MembershipReceiptSchema, ...failures },
			detail: { operationId: "declineOrganizationMembershipInvitation", tags: ["Participation"] },
		},
		({ principalContext, params, body }) =>
			runAccessTransaction((tx) =>
				declineMembershipInvitation(tx, principalContext, params.invitationId, body),
			),
	)
	.post(
		"/me/organizations/:organizationEntityId/leave",
		{
			principalAccess: write,
			params: org,
			body: MembershipDepartureSchema,
			response: { 200: MembershipReceiptSchema, ...failures },
			detail: { operationId: "leaveOrganizationMembership", tags: ["Participation"] },
		},
		({ principalContext, params, body }) =>
			runAccessTransaction((tx) =>
				leaveOrganization(tx, principalContext, params.organizationEntityId, body),
			),
	)
	.post(
		"/organizations/:organizationEntityId/contacts",
		{
			principalAccess: write,
			params: org,
			response: { 200: MembershipContactSchema, ...failures },
			detail: { operationId: "createOrganizationEnrollmentContact", tags: ["Participation"] },
		},
		({ principalContext, params }) =>
			runAccessTransaction((tx) =>
				createOrganizationEnrollmentContact(tx, principalContext, params.organizationEntityId),
			),
	)
	.post(
		"/contacts/:id/revoke",
		{
			principalAccess: write,
			params: z.strictObject({ id: z.uuid() }),
			response: {
				200: z.strictObject({ id: z.uuid(), version: z.literal(2), revoked: z.boolean() }),
				...failures,
			},
			detail: { operationId: "revokeOrganizationEnrollmentContact", tags: ["Participation"] },
		},
		({ principalContext, params }) =>
			runAccessTransaction((tx) =>
				revokeOrganizationEnrollmentContact(tx, principalContext, params.id),
			),
	)
	.post(
		"/organizations/:organizationEntityId/recipients",
		{
			principalAccess: write,
			params: org,
			body: z.strictObject({ contact: z.string().regex(/^[A-Za-z0-9_-]{43}$/) }),
			response: {
				200: z.strictObject({ recipient: MembershipRecipientSchema, expiresAt: z.iso.datetime() }),
				...failures,
			},
			detail: { operationId: "resolveOrganizationEnrollmentContact", tags: ["Participation"] },
		},
		({ principalContext, params, body }) =>
			runAccessTransaction((tx) =>
				resolveOrganizationEnrollmentContact(
					tx,
					principalContext,
					params.organizationEntityId,
					body.contact,
				),
			),
	);
