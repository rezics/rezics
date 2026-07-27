import { PlatformCapabilityValues } from "@rezics/access";
import { desc, inArray } from "drizzle-orm";
import { StatusCodes } from "http-status-codes";
import Elysia from "elysia";

import session from "../../auth/session";
import { database } from "../../database";
import { auditEvent } from "../../database/schema";
import {
	listStaffMembers,
	replacePlatformAccess,
	searchStaffProfiles,
} from "../../staff/access-service";
import { primaryUnitTitle } from "../../units/localization";
import { toApiErrorResponse } from "../schema/response";
import {
	ReplaceStaffAccessBody,
	StaffAccessPolicyResponse,
	StaffAccessProfileListResponse,
	StaffAccessProfileResponse,
	StaffAuditListResponse,
	StaffAuditQuery,
	StaffMemberParams,
	StaffProfileSearchQuery,
} from "./schema";

const StaffCapabilityRequiredResponse = toApiErrorResponse(["PlatformCapabilityRequired"]);
const StaffMutationForbiddenResponse = toApiErrorResponse([
	"PlatformCapabilityRequired",
	"FreshSessionRequired",
]);

const StaffAuditActions = [
	"capability_grant.bootstrap",
	"capability_grant.upsert",
	"capability_grant.revoke",
	"platform_access.replace",
] as const;

export default new Elysia({ prefix: "/staff" })
	.use(session)
	.get(
		"/access-policy",
		async ({ authorization }) => {
			await authorization.platform.ensureCapability("platform.grants.manage");
			return { capabilities: [...PlatformCapabilityValues] };
		},
		{
			access: "session-only",
			response: {
				[StatusCodes.OK]: StaffAccessPolicyResponse,
				[StatusCodes.FORBIDDEN]: StaffCapabilityRequiredResponse,
			},
			detail: { summary: "Get platform staff access policy", tags: ["Staff"] },
		},
	)
	.get(
		"/profiles",
		async ({ authorization, query }) => {
			await authorization.platform.ensureCapability("platform.grants.manage");
			return {
				items: await searchStaffProfiles(database, query.query, query.limit ?? 20),
			};
		},
		{
			access: "session-only",
			query: StaffProfileSearchQuery,
			response: {
				[StatusCodes.OK]: StaffAccessProfileListResponse,
				[StatusCodes.FORBIDDEN]: StaffCapabilityRequiredResponse,
			},
			detail: { summary: "Search Profiles for staff access", tags: ["Staff"] },
		},
	)
	.get(
		"/members",
		async ({ authorization }) => {
			await authorization.platform.ensureCapability("platform.grants.manage");
			return { items: await listStaffMembers(database) };
		},
		{
			access: "session-only",
			response: {
				[StatusCodes.OK]: StaffAccessProfileListResponse,
				[StatusCodes.FORBIDDEN]: StaffCapabilityRequiredResponse,
			},
			detail: { summary: "List active staff access", tags: ["Staff"] },
		},
	)
	.put(
		"/members/:profileId",
		async ({ authorization, body, params, profile }) => {
			await authorization.platform.ensureCapability("platform.grants.manage");
			return database.transaction((tx) =>
				replacePlatformAccess(tx, {
					actorProfileId: profile.unitId,
					targetProfileId: params.profileId,
					capabilities: body.capabilities,
					expiresAt: body.expiresAt,
				}),
			);
		},
		{
			access: "fresh-session-only",
			params: StaffMemberParams,
			body: ReplaceStaffAccessBody,
			response: {
				[StatusCodes.OK]: StaffAccessProfileResponse,
				[StatusCodes.BAD_REQUEST]: toApiErrorResponse(["CapabilityGrantExpiryInvalid"]),
				[StatusCodes.FORBIDDEN]: StaffMutationForbiddenResponse,
				[StatusCodes.NOT_FOUND]: toApiErrorResponse(["ProfileNotFound"]),
				[StatusCodes.CONFLICT]: toApiErrorResponse(["PlatformGrantManagerRequired"]),
			},
			detail: { summary: "Replace a Profile's platform access", tags: ["Staff"] },
		},
	)
	.get(
		"/audit",
		async ({ authorization, query }) => {
			await authorization.platform.ensureCapability("platform.grants.manage");
			return {
				items: await database
					.select({
						id: auditEvent.id,
						actorProfileId: auditEvent.actorProfileId,
						actorName: primaryUnitTitle(auditEvent.actorProfileId),
						action: auditEvent.action,
						decisionCode: auditEvent.decisionCode,
						subjectProfileId: auditEvent.subjectId,
						subjectName: primaryUnitTitle(auditEvent.subjectId),
						metadata: auditEvent.metadata,
						createdAt: auditEvent.createdAt,
					})
					.from(auditEvent)
					.where(inArray(auditEvent.action, [...StaffAuditActions]))
					.orderBy(desc(auditEvent.createdAt), desc(auditEvent.id))
					.limit(query.limit ?? 50),
			};
		},
		{
			access: "session-only",
			query: StaffAuditQuery,
			response: {
				[StatusCodes.OK]: StaffAuditListResponse,
				[StatusCodes.FORBIDDEN]: StaffCapabilityRequiredResponse,
			},
			detail: { summary: "List staff access audit events", tags: ["Staff"] },
		},
	);
