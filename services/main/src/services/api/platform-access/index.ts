import { PlatformCapabilityValues } from "@rezics/access";
import { StatusCodes } from "http-status-codes";
import Elysia from "elysia";

import session from "../../auth/session";
import { database } from "../../database";
import {
	getPlatformAccessProfile,
	listPlatformAccessProfiles,
	replacePlatformAccess,
	searchPlatformAccessProfiles,
} from "../../platform-access";
import { toApiErrorResponse } from "../schema/response";
import {
	PlatformAccessPolicyResponse,
	PlatformAccessProfileListResponse,
	PlatformAccessProfileParams,
	PlatformAccessProfileResponse,
	PlatformAccessProfilesQuery,
	ReplacePlatformAccessBody,
} from "./schema";

const PlatformAccessReadErrorResponse = toApiErrorResponse(["PlatformCapabilityRequired"]);
const PlatformAccessMutationErrorResponse = toApiErrorResponse([
	"PlatformCapabilityRequired",
	"FreshSessionRequired",
]);

export default new Elysia({ prefix: "/platform-access" })
	.use(session)
	.get(
		"/policy",
		async ({ authorization }) => {
			await authorization.platform.ensureCapability("platform.access.read");
			return { capabilities: [...PlatformCapabilityValues] };
		},
		{
			access: "session-only",
			response: {
				[StatusCodes.OK]: PlatformAccessPolicyResponse,
				[StatusCodes.FORBIDDEN]: PlatformAccessReadErrorResponse,
			},
			detail: { summary: "Get the platform access policy", tags: ["Platform access"] },
		},
	)
	.get(
		"/profiles",
		async ({ authorization, query }) => {
			await authorization.platform.ensureCapability("platform.access.read");
			return {
				items: query.query
					? await searchPlatformAccessProfiles(database, query.query, query.limit ?? 50)
					: (await listPlatformAccessProfiles(database)).slice(0, query.limit ?? 50),
			};
		},
		{
			access: "session-only",
			query: PlatformAccessProfilesQuery,
			response: {
				[StatusCodes.OK]: PlatformAccessProfileListResponse,
				[StatusCodes.FORBIDDEN]: PlatformAccessReadErrorResponse,
			},
			detail: {
				summary: "List or search Profiles and their platform access",
				tags: ["Platform access"],
			},
		},
	)
	.get(
		"/profiles/:profileId",
		async ({ authorization, params }) => {
			await authorization.platform.ensureCapability("platform.access.read");
			return getPlatformAccessProfile(database, params.profileId);
		},
		{
			access: "session-only",
			params: PlatformAccessProfileParams,
			response: {
				[StatusCodes.OK]: PlatformAccessProfileResponse,
				[StatusCodes.FORBIDDEN]: PlatformAccessReadErrorResponse,
				[StatusCodes.NOT_FOUND]: toApiErrorResponse(["ProfileNotFound"]),
			},
			detail: { summary: "Get one Profile's platform access", tags: ["Platform access"] },
		},
	)
	.put(
		"/profiles/:profileId",
		async ({ authorization, body, params, profile }) => {
			await authorization.platform.ensureCapability("platform.access.manage");
			return database.transaction((tx) =>
				replacePlatformAccess(tx, {
					actorProfileId: profile.unitId,
					targetProfileId: params.profileId,
					expectedRevision: body.expectedRevision,
					grants: body.grants.map((grant) => ({
						...grant,
						expiresAt: grant.expiresAt,
					})),
				}),
			);
		},
		{
			access: "fresh-session-only",
			params: PlatformAccessProfileParams,
			body: ReplacePlatformAccessBody,
			response: {
				[StatusCodes.OK]: PlatformAccessProfileResponse,
				[StatusCodes.BAD_REQUEST]: toApiErrorResponse([
					"CapabilityGrantExpiryInvalid",
					"PlatformAccessConfigurationInvalid",
				]),
				[StatusCodes.FORBIDDEN]: PlatformAccessMutationErrorResponse,
				[StatusCodes.NOT_FOUND]: toApiErrorResponse(["ProfileNotFound"]),
				[StatusCodes.CONFLICT]: toApiErrorResponse([
					"PlatformAccessManagerRequired",
					"PlatformAccessRevisionConflict",
				]),
			},
			detail: { summary: "Replace one Profile's platform access", tags: ["Platform access"] },
		},
	);
