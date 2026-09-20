import { readRealmEnrollmentRules } from "../../realms/enrollment-rules";
import { RealmRulesQuery } from "./schema";
import {
	createRealmEnrollmentContact,
	resolveRealmEnrollmentContact,
	revokeRealmEnrollmentContact,
} from "../../realms/membership-contact";
import { RealmMemberListResponse, RealmRulesResponse } from "../schema/action-response";
import Elysia from "elysia";
import { z } from "zod";
import principalSession from "../../auth/principal-session";
import { runAccessTransaction } from "../../authorization/transaction";
import {
	joinRealm,
	leaveRealm,
	updateRealmMember,
	acknowledgeRealmRules,
} from "../../realms/membership";
import {
	readRealmEnrollment,
	listRealmMembers,
	listRealmMembershipHistory,
	listPublicRealmMembers,
	realmMembershipCapabilities,
} from "../../realms/roster";
import {
	JoinRealmSchema,
	RealmEnrollmentExpectedSchema,
	RealmEnrollmentCommandSchema,
	RealmEnrollmentReceiptSchema,
	RealmEnrollmentStatusSchema,
	RealmEnrollmentPageQuerySchema,
	RealmEnrollmentPageSchema,
	RealmRuleConsentSchema,
} from "../../realms/membership-contracts";
import { MembershipRecipientSchema } from "../../participation/membership-contracts";
import { toApiErrorResponse } from "../schema/response";
const params = z.strictObject({ realmId: z.uuid() }),
	read = { permission: "access:read", fresh: false, write: false } as const,
	write = { permission: "access:manage", fresh: true, write: true } as const;
const failures = {
	403: toApiErrorResponse(["AccessDenied"]),
	404: toApiErrorResponse(["AccessRecordUnavailable"]),
	409: toApiErrorResponse(["AccessChanged", "RealmRulesAcceptanceRequired"]),
	503: toApiErrorResponse(["AccessUnavailable"]),
};
/** Realm enrollment uses explicit selected authority for private and public participation. @alpha */
export default new Elysia({ name: "realm-native-membership" })
	.use(principalSession)
	.post(
		"/:realmId/enrollment-contact",
		{
			principalAccess: write,
			params,
			response: {
				200: z.strictObject({
					id: z.uuid(),
					revision: z.number().int(),
					contact: z.string(),
					expiresAt: z.iso.datetime(),
				}),
				...failures,
			},
			detail: { operationId: "createRealmEnrollmentContact", tags: ["Realms"] },
		},
		({ principalContext, params }) =>
			runAccessTransaction((tx) =>
				createRealmEnrollmentContact(tx, principalContext, params.realmId),
			),
	)
	.post(
		"/:realmId/enrollment-contacts/resolve",
		{
			principalAccess: write,
			params,
			body: z.strictObject({ contact: z.string().min(32).max(128) }),
			response: {
				200: z.strictObject({ contactId: z.uuid(), recipient: MembershipRecipientSchema }),
				...failures,
			},
			detail: { operationId: "resolveRealmEnrollmentContact", tags: ["Realms"] },
		},
		({ principalContext, params, body }) =>
			runAccessTransaction((tx) =>
				resolveRealmEnrollmentContact(tx, principalContext, params.realmId, body.contact),
			),
	)
	.delete(
		"/enrollment-contacts/:contactId",
		{
			principalAccess: write,
			params: z.strictObject({ contactId: z.uuid() }),
			body: z.strictObject({ expectedRevision: z.number().int().min(1).max(2) }),
			response: { 200: z.strictObject({ id: z.uuid(), revision: z.number().int() }), ...failures },
			detail: { operationId: "revokeRealmEnrollmentContact", tags: ["Realms"] },
		},
		({ principalContext, params, body }) =>
			runAccessTransaction((tx) =>
				revokeRealmEnrollmentContact(tx, principalContext, params.contactId, body.expectedRevision),
			),
	)
	.get(
		"/:realmId/enrollment-rules",
		{
			principalAccess: read,
			params,
			query: RealmRulesQuery,
			response: { 200: RealmRulesResponse, ...failures },
			detail: { operationId: "getRealmEnrollmentRules", tags: ["Realms"] },
		},
		({ principalContext, params, query }) =>
			runAccessTransaction((tx) =>
				readRealmEnrollmentRules(
					tx,
					principalContext,
					params.realmId,
					query.localizationLanguages ?? [],
				),
			),
	)
	.get(
		"/:realmId/membership-capabilities",
		{
			principalAccess: read,
			params,
			response: {
				200: z.strictObject({ canReadMembers: z.boolean(), canManageMembers: z.boolean() }),
				...failures,
			},
			detail: { operationId: "getRealmMembershipCapabilities", tags: ["Realms"] },
		},
		({ principalContext, params }) =>
			runAccessTransaction((tx) =>
				realmMembershipCapabilities(tx, principalContext, params.realmId),
			),
	)
	.get(
		"/:realmId/membership",
		{
			principalAccess: read,
			params,
			response: { 200: RealmEnrollmentStatusSchema, ...failures },
			detail: { operationId: "getRealmMembership", tags: ["Realms"] },
		},
		({ principalContext, params }) =>
			runAccessTransaction((tx) => readRealmEnrollment(tx, principalContext, params.realmId)),
	)
	.post(
		"/:realmId/membership",
		{
			principalAccess: write,
			params,
			body: JoinRealmSchema,
			response: { 200: RealmEnrollmentReceiptSchema, ...failures },
			detail: { operationId: "joinRealm", tags: ["Realms"] },
		},
		({ principalContext, params, body }) =>
			runAccessTransaction((tx) => joinRealm(tx, principalContext, params.realmId, body)),
	)
	.delete(
		"/:realmId/membership",
		{
			principalAccess: write,
			params,
			body: RealmEnrollmentExpectedSchema,
			response: { 200: RealmEnrollmentReceiptSchema, ...failures },
			detail: { operationId: "leaveRealm", tags: ["Realms"] },
		},
		({ principalContext, params, body }) =>
			runAccessTransaction((tx) => leaveRealm(tx, principalContext, params.realmId, body)),
	)
	.get(
		"/:realmId/enrollments",
		{
			principalAccess: read,
			params,
			query: RealmEnrollmentPageQuerySchema,
			response: { 200: RealmEnrollmentPageSchema, ...failures },
			detail: { operationId: "listRealmEnrollments", tags: ["Realms"] },
		},
		({ principalContext, params, query }) =>
			runAccessTransaction((tx) => listRealmMembers(tx, principalContext, params.realmId, query)),
	)
	.get(
		"/:realmId/members",
		{
			principalAccess: read,
			params,
			query: z.strictObject({
				afterId: z.string().max(512).optional(),
				localizationLanguages: z.array(z.string().max(64)).max(16).optional(),
			}),
			response: { 200: RealmMemberListResponse, ...failures },
			detail: { operationId: "listRealmMembers", tags: ["Realms"] },
		},
		({ principalContext, params, query }) =>
			runAccessTransaction((tx) =>
				listPublicRealmMembers(tx, principalContext, params.realmId, query),
			),
	)
	.post(
		"/:realmId/members/inspect",
		{
			principalAccess: read,
			params,
			body: MembershipRecipientSchema,
			response: { 200: RealmEnrollmentStatusSchema, ...failures },
			detail: { operationId: "inspectRealmMember", tags: ["Realms"] },
		},
		({ principalContext, params, body }) =>
			runAccessTransaction((tx) => readRealmEnrollment(tx, principalContext, params.realmId, body)),
	)
	.patch(
		"/:realmId/members",
		{
			principalAccess: write,
			params,
			body: RealmEnrollmentCommandSchema,
			response: { 200: RealmEnrollmentReceiptSchema, ...failures },
			detail: { operationId: "updateRealmMember", tags: ["Realms"] },
		},
		({ principalContext, params, body }) =>
			runAccessTransaction((tx) => updateRealmMember(tx, principalContext, params.realmId, body)),
	)
	.post(
		"/:realmId/members/history",
		{
			principalAccess: read,
			params,
			body: z.strictObject({
				recipient: MembershipRecipientSchema,
				afterRevision: z.number().int().nonnegative().safe().optional(),
			}),
			response: {
				200: z.strictObject({
					items: z
						.array(
							z.strictObject({
								operationId: z.uuid(),
								operation: z.string(),
								result: RealmEnrollmentReceiptSchema,
								createdAt: z.iso.datetime(),
							}),
						)
						.max(50),
					nextCursor: z.number().int().nonnegative().safe().nullable(),
				}),
				...failures,
			},
			detail: { operationId: "getRealmMemberHistory", tags: ["Realms"] },
		},
		({ principalContext, params, body }) =>
			runAccessTransaction((tx) =>
				listRealmMembershipHistory(
					tx,
					principalContext,
					params.realmId,
					body.recipient,
					body.afterRevision,
				),
			),
	)
	.put(
		"/:realmId/rules/:revisionId/acknowledgement",
		{
			principalAccess: write,
			params: params.extend({ revisionId: z.uuid() }),
			body: RealmRuleConsentSchema,
			response: { 200: RealmEnrollmentReceiptSchema, ...failures },
			detail: { operationId: "acknowledgeRealmRules", tags: ["Realms"] },
		},
		({ principalContext, params, body }) =>
			runAccessTransaction((tx) =>
				acknowledgeRealmRules(tx, principalContext, params.realmId, params.revisionId, body),
			),
	);
