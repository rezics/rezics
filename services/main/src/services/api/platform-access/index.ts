import {
	CustomThemeExternalLiveAccessManageCapability,
	PlatformCapabilityValues,
} from "@rezics/access";
import Elysia from "elysia";
import { StatusCodes } from "http-status-codes";

import session from "../../auth/session";
import { database } from "../../database";
import {
	getCustomThemeExternalLiveAccessAccount,
	getPlatformAccessAccount,
	listPlatformAccessAccounts,
	replacePlatformAccess,
	searchCustomThemeExternalLiveAccessAccounts,
	searchPlatformAccessAccounts,
	setCustomThemeExternalLiveAccess,
} from "../../platform-access";
import { toApiErrorResponse } from "../schema/response";
import {
	CustomThemeExternalLiveAccessAccountListResponse,
	CustomThemeExternalLiveAccessAccountResponse,
	PlatformAccessAccountListResponse,
	PlatformAccessAccountParams,
	PlatformAccessAccountResponse,
	PlatformAccessAccountsQuery,
	PlatformAccessPolicyResponse,
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
		"/custom-theme-external-live/accounts",
		{
			access: "session-only",
			query: PlatformAccessAccountsQuery,
			response: {
				[StatusCodes.OK]: CustomThemeExternalLiveAccessAccountListResponse,
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
				items: await searchCustomThemeExternalLiveAccessAccounts(database, {
					query: query.query,
					limit: query.limit ?? 50,
				}),
			};
		},
	)
	.get(
		"/accounts/:authUserId/custom-theme-external-live-access",
		{
			access: "session-only",
			params: PlatformAccessAccountParams,
			response: {
				[StatusCodes.OK]: CustomThemeExternalLiveAccessAccountResponse,
				[StatusCodes.FORBIDDEN]: CustomThemeExternalLiveAccessReadErrorResponse,
				[StatusCodes.NOT_FOUND]: toApiErrorResponse(["UserNotFound"]),
			},
			detail: {
				summary: "Get one Profile's Custom Theme external-live access",
				tags: ["Platform access"],
			},
		},
		async ({ authorization, params }) => {
			await authorization.platform.ensureCapability(CustomThemeExternalLiveAccessManageCapability);
			return getCustomThemeExternalLiveAccessAccount(database, params.authUserId);
		},
	)
	.put(
		"/accounts/:authUserId/custom-theme-external-live-access",
		{
			access: "fresh-session-only",
			params: PlatformAccessAccountParams,
			body: SetCustomThemeExternalLiveAccessBody,
			response: {
				[StatusCodes.OK]: CustomThemeExternalLiveAccessAccountResponse,
				[StatusCodes.BAD_REQUEST]: toApiErrorResponse(["CapabilityGrantExpiryInvalid"]),
				[StatusCodes.FORBIDDEN]: CustomThemeExternalLiveAccessMutationErrorResponse,
				[StatusCodes.NOT_FOUND]: toApiErrorResponse(["UserNotFound"]),
				[StatusCodes.CONFLICT]: toApiErrorResponse(["PlatformAccessRevisionConflict"]),
			},
			detail: {
				summary: "Grant, renew, or revoke Custom Theme external-live access",
				tags: ["Platform access"],
			},
		},
		async ({ authorization, body, params, user }) => {
			await authorization.platform.ensureCapability(CustomThemeExternalLiveAccessManageCapability);
			return database.transaction((tx) =>
				setCustomThemeExternalLiveAccess(tx, {
					actorAuthUserId: user.id,
					targetAuthUserId: params.authUserId,
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
		"/accounts",
		{
			access: "session-only",
			query: PlatformAccessAccountsQuery,
			response: {
				[StatusCodes.OK]: PlatformAccessAccountListResponse,
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
					? await searchPlatformAccessAccounts(database, query.query, query.limit ?? 50)
					: (await listPlatformAccessAccounts(database)).slice(0, query.limit ?? 50),
			};
		},
	)
	.get(
		"/accounts/:authUserId",
		{
			access: "session-only",
			params: PlatformAccessAccountParams,
			response: {
				[StatusCodes.OK]: PlatformAccessAccountResponse,
				[StatusCodes.FORBIDDEN]: PlatformAccessReadErrorResponse,
				[StatusCodes.NOT_FOUND]: toApiErrorResponse(["UserNotFound"]),
			},
			detail: { summary: "Get one Profile's platform access", tags: ["Platform access"] },
		},
		async ({ authorization, params }) => {
			await authorization.platform.ensureCapability("platform.access.read");
			return getPlatformAccessAccount(database, params.authUserId);
		},
	)
	.put(
		"/accounts/:authUserId",
		{
			access: "fresh-session-only",
			params: PlatformAccessAccountParams,
			body: ReplacePlatformAccessBody,
			response: {
				[StatusCodes.OK]: PlatformAccessAccountResponse,
				[StatusCodes.BAD_REQUEST]: toApiErrorResponse([
					"CapabilityGrantExpiryInvalid",
					"PlatformAccessConfigurationInvalid",
				]),
				[StatusCodes.FORBIDDEN]: PlatformAccessMutationErrorResponse,
				[StatusCodes.NOT_FOUND]: toApiErrorResponse(["UserNotFound"]),
				[StatusCodes.CONFLICT]: toApiErrorResponse([
					"PlatformAccessManagerRequired",
					"PlatformAccessRevisionConflict",
				]),
			},
			detail: { summary: "Replace one Profile's platform access", tags: ["Platform access"] },
		},
		async ({ authorization, body, params, user }) => {
			await authorization.platform.ensureCapability("platform.access.manage");
			return database.transaction((tx) =>
				replacePlatformAccess(tx, {
					actorAuthUserId: user.id,
					targetAuthUserId: params.authUserId,
					expectedRevision: body.expectedRevision,
					grants: body.grants.map((grant) => ({
						...grant,
						expiresAt: grant.expiresAt,
					})),
				}),
			);
		},
	);
