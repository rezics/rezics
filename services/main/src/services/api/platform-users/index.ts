import { StatusCodes } from "http-status-codes";
import Elysia from "elysia";

import sessionContext from "../../auth/session";
import { InteractiveSessionRequired } from "../../auth/errors";
import {
	getPlatformUser,
	listPlatformUsers,
	listPlatformUserSessions,
	replacePlatformUserAccountState,
	revokeAllPlatformUserSessions,
	revokePlatformUserSession,
} from "../../platform-users/service";
import { toApiErrorResponse } from "../schema/response";
import {
	PlatformUserAccountStateResponse,
	PlatformUserListResponse,
	PlatformUserParams,
	PlatformUserResponse,
	PlatformUsersQuery,
	PlatformUserSessionListResponse,
	PlatformUserSessionParams,
	ReplacePlatformUserAccountStateBody,
	SessionRevocationResponse,
} from "./schema";

const AuthenticationResponse = toApiErrorResponse([
	"AuthenticationRequired",
	"InteractiveSessionRequired",
]);
const UserReadForbiddenResponse = toApiErrorResponse([
	"AccountSuspended",
	"AccountClosed",
	"PlatformCapabilityRequired",
]);
const UserMutationForbiddenResponse = toApiErrorResponse([
	"AccountSuspended",
	"AccountClosed",
	"FreshSessionRequired",
	"PlatformCapabilityRequired",
]);
const UserNotFoundResponse = toApiErrorResponse(["UserNotFound"]);
const UserMutationConflictResponse = toApiErrorResponse([
	"UserAccountStateRevisionConflict",
	"UserSelfStatusChangeForbidden",
	"PlatformUserManagerRequired",
]);

export default new Elysia({ prefix: "/platform-users" })
	.use(sessionContext)
	.get(
		"",
		async ({ authorization, query }) => {
			await authorization.platform.ensureCapability("platform.user.read");
			return listPlatformUsers({
				cursor: query.cursor,
				limit: query.limit ?? 50,
				search: query.search,
				state: query.state,
				emailVerified: query.emailVerified,
			});
		},
		{
			access: "session-only",
			query: PlatformUsersQuery,
			response: {
				[StatusCodes.OK]: PlatformUserListResponse,
				[StatusCodes.BAD_REQUEST]: toApiErrorResponse(["InvalidPaginationCursor"]),
				[StatusCodes.UNAUTHORIZED]: AuthenticationResponse,
				[StatusCodes.FORBIDDEN]: UserReadForbiddenResponse,
			},
			detail: { summary: "List platform users", tags: ["Platform Users"] },
		},
	)
	.get(
		"/:userId",
		async ({ authorization, params }) => {
			await authorization.platform.ensureCapability("platform.user.read");
			return getPlatformUser(params.userId);
		},
		{
			access: "session-only",
			params: PlatformUserParams,
			response: {
				[StatusCodes.OK]: PlatformUserResponse,
				[StatusCodes.UNAUTHORIZED]: AuthenticationResponse,
				[StatusCodes.FORBIDDEN]: UserReadForbiddenResponse,
				[StatusCodes.NOT_FOUND]: UserNotFoundResponse,
			},
			detail: { summary: "Get one platform user", tags: ["Platform Users"] },
		},
	)
	.put(
		"/:userId/account-state",
		async ({ authorization, profile, user, params, body }) => {
			await authorization.platform.ensureCapability("platform.user.status.update");
			return replacePlatformUserAccountState({
				actorProfileId: profile.unitId,
				actorUserId: user.id,
				targetUserId: params.userId,
				command: body,
			});
		},
		{
			access: "fresh-session-only",
			params: PlatformUserParams,
			body: ReplacePlatformUserAccountStateBody,
			response: {
				[StatusCodes.OK]: PlatformUserAccountStateResponse,
				[StatusCodes.UNAUTHORIZED]: AuthenticationResponse,
				[StatusCodes.FORBIDDEN]: UserMutationForbiddenResponse,
				[StatusCodes.NOT_FOUND]: UserNotFoundResponse,
				[StatusCodes.CONFLICT]: UserMutationConflictResponse,
				[StatusCodes.UNPROCESSABLE_ENTITY]: toApiErrorResponse(["UserAccountStateExpiryInvalid"]),
			},
			detail: { summary: "Replace a platform user account state", tags: ["Platform Users"] },
		},
	)
	.get(
		"/:userId/sessions",
		async ({ authorization, session, params }) => {
			await authorization.platform.ensureCapability("platform.session.read");
			if (!session) throw new InteractiveSessionRequired();
			return {
				items: await listPlatformUserSessions(params.userId, session.id),
			};
		},
		{
			access: "session-only",
			params: PlatformUserParams,
			response: {
				[StatusCodes.OK]: PlatformUserSessionListResponse,
				[StatusCodes.UNAUTHORIZED]: AuthenticationResponse,
				[StatusCodes.FORBIDDEN]: UserReadForbiddenResponse,
				[StatusCodes.NOT_FOUND]: UserNotFoundResponse,
			},
			detail: { summary: "List a platform user's sessions", tags: ["Platform Users"] },
		},
	)
	.delete(
		"/:userId/sessions/:sessionId",
		async ({ authorization, profile, params }) => {
			await authorization.platform.ensureCapability("platform.session.revoke");
			return revokePlatformUserSession({
				actorProfileId: profile.unitId,
				targetUserId: params.userId,
				sessionId: params.sessionId,
			});
		},
		{
			access: "fresh-session-only",
			params: PlatformUserSessionParams,
			response: {
				[StatusCodes.OK]: SessionRevocationResponse,
				[StatusCodes.UNAUTHORIZED]: AuthenticationResponse,
				[StatusCodes.FORBIDDEN]: UserMutationForbiddenResponse,
				[StatusCodes.NOT_FOUND]: toApiErrorResponse(["SessionNotFound"]),
			},
			detail: { summary: "Revoke a platform user session", tags: ["Platform Users"] },
		},
	)
	.delete(
		"/:userId/sessions",
		async ({ authorization, profile, params }) => {
			await authorization.platform.ensureCapability("platform.session.revoke");
			return revokeAllPlatformUserSessions({
				actorProfileId: profile.unitId,
				targetUserId: params.userId,
			});
		},
		{
			access: "fresh-session-only",
			params: PlatformUserParams,
			response: {
				[StatusCodes.OK]: SessionRevocationResponse,
				[StatusCodes.UNAUTHORIZED]: AuthenticationResponse,
				[StatusCodes.FORBIDDEN]: UserMutationForbiddenResponse,
				[StatusCodes.NOT_FOUND]: UserNotFoundResponse,
			},
			detail: { summary: "Revoke all platform user sessions", tags: ["Platform Users"] },
		},
	);
