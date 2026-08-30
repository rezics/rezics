import {
	CustomThemeExternalLiveAccessManageCapability,
	PlatformCapabilityValues,
} from "@rezics/access";
import { StatusCodes } from "http-status-codes";
import Elysia from "elysia";

import session from "../../auth/session";
import { database } from "../../database";
import {
	getPlatformAccessProfile,
	getCustomThemeExternalLiveAccessProfile,
	listPlatformAccessProfiles,
	replacePlatformAccess,
	searchCustomThemeExternalLiveAccessProfiles,
	searchPlatformAccessProfiles,
	setCustomThemeExternalLiveAccess,
} from "../../platform-access";
import { toApiErrorResponse } from "../schema/response";
import {
	CustomThemeExternalLiveAccessProfileListResponse,
	CustomThemeExternalLiveAccessProfileResponse,
	PlatformAccessPolicyResponse,
	PlatformAccessProfileListResponse,
	PlatformAccessProfileParams,
	PlatformAccessProfileResponse,
	PlatformAccessProfilesQuery,
	ReplacePlatformAccessBody,
	SetCustomThemeExternalLiveAccessBody,
} from "./schema";

const PlatformAccessReadErrorResponse = toApiErrorResponse(["PlatformCapabilityRequired"]);
const PlatformAccessMutationErrorResponse = toApiErrorResponse([
	"PlatformCapabilityRequired",
	"FreshSessionRequired",
]);
const CustomThemeExternalLiveAccessReadErrorResponse = toApiErrorResponse([
	"PlatformCapabilityRequired",
]);
const CustomThemeExternalLiveAccessMutationErrorResponse = toApiErrorResponse([
	"PlatformCapabilityRequired",
	"FreshSessionRequired",
	"CustomThemeExternalLiveAccessSelfMutationForbidden",
	"PlatformAccessConfigurationInvalid",
]);

export default new Elysia({ prefix: "/platform-access" })
	.use(session)
	.get(
		"/custom-theme-external-live/profiles",
		{
			access: "session-only",
			query: PlatformAccessProfilesQuery,
			response: {
				[StatusCodes.OK]: CustomThemeExternalLiveAccessProfileListResponse,
				[StatusCodes.FORBIDDEN]: CustomThemeExternalLiveAccessReadErrorResponse,
			},
			detail: {
				summary: "List or search Profiles for Custom Theme external-live access",
				tags: ["Platform access"],
			},
		},
		async ({ authorization, query }) => {
			await authorization.platform.ensureCapability(CustomThemeExternalLiveAccessManageCapability);
			return {
				items: await searchCustomThemeExternalLiveAccessProfiles(database, {
					query: query.query,
					limit: query.limit ?? 50,
				}),
			};
		},
	)
	.get(
		"/profiles/:profileId/custom-theme-external-live-access",
		{
			access: "session-only",
			params: PlatformAccessProfileParams,
			response: {
				[StatusCodes.OK]: CustomThemeExternalLiveAccessProfileResponse,
				[StatusCodes.FORBIDDEN]: CustomThemeExternalLiveAccessReadErrorResponse,
				[StatusCodes.NOT_FOUND]: toApiErrorResponse(["ProfileNotFound"]),
			},
			detail: {
				summary: "Get one Profile's Custom Theme external-live access",
				tags: ["Platform access"],
			},
		},
		async ({ authorization, params }) => {
			await authorization.platform.ensureCapability(CustomThemeExternalLiveAccessManageCapability);
			return getCustomThemeExternalLiveAccessProfile(database, params.profileId);
		},
	)
	.put(
		"/profiles/:profileId/custom-theme-external-live-access",
		{
			access: "fresh-session-only",
			params: PlatformAccessProfileParams,
			body: SetCustomThemeExternalLiveAccessBody,
			response: {
				[StatusCodes.OK]: CustomThemeExternalLiveAccessProfileResponse,
				[StatusCodes.BAD_REQUEST]: toApiErrorResponse(["CapabilityGrantExpiryInvalid"]),
				[StatusCodes.FORBIDDEN]: CustomThemeExternalLiveAccessMutationErrorResponse,
				[StatusCodes.NOT_FOUND]: toApiErrorResponse(["ProfileNotFound"]),
				[StatusCodes.CONFLICT]: toApiErrorResponse(["PlatformAccessRevisionConflict"]),
			},
			detail: {
				summary: "Grant, renew, or revoke Custom Theme external-live access",
				tags: ["Platform access"],
			},
		},
		async ({ authorization, body, params, profile }) => {
			await authorization.platform.ensureCapability(CustomThemeExternalLiveAccessManageCapability);
			return database.transaction((tx) =>
				setCustomThemeExternalLiveAccess(tx, {
					actorProfileId: profile.unitId,
					targetProfileId: params.profileId,
					expectedRevision: body.expectedRevision,
					state: body.state,
					...(body.state === "granted" ? { expiresAt: body.expiresAt } : {}),
				}),
			);
		},
	)
	.get(
		"/policy",
		{
			access: "session-only",
			response: {
				[StatusCodes.OK]: PlatformAccessPolicyResponse,
				[StatusCodes.FORBIDDEN]: PlatformAccessReadErrorResponse,
			},
			detail: { summary: "Get the platform access policy", tags: ["Platform access"] },
		},
		async ({ authorization }) => {
			await authorization.platform.ensureCapability("platform.access.read");
			return { capabilities: [...PlatformCapabilityValues] };
		},
	)
	.get(
		"/profiles",
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
		async ({ authorization, query }) => {
			await authorization.platform.ensureCapability("platform.access.read");
			return {
				items: query.query
					? await searchPlatformAccessProfiles(database, query.query, query.limit ?? 50)
					: (await listPlatformAccessProfiles(database)).slice(0, query.limit ?? 50),
			};
		},
	)
	.get(
		"/profiles/:profileId",
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
		async ({ authorization, params }) => {
			await authorization.platform.ensureCapability("platform.access.read");
			return getPlatformAccessProfile(database, params.profileId);
		},
	)
	.put(
		"/profiles/:profileId",
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
	);
