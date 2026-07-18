import { StatusCodes } from "http-status-codes";

import Elysia, { t } from "elysia";

import { fromApiKeyPermissions, toApiKeyPermissions } from "../../auth/api-permissions";
import session from "../../auth/session";
import { auth } from "../../auth";
import { NoContentResponse } from "../schema/action-response";
import { toApiErrorResponse } from "../schema/response";
import { ApiTokenNotFound } from "./errors";
import {
	ApiTokenListResponse,
	ApiTokenParams,
	ApiTokenSummary,
	CreatedApiTokenResponse,
	CreateApiTokenBody,
	UpdateApiTokenBody,
} from "./schema";

const InteractiveSessionRequiredResponse = toApiErrorResponse(["InteractiveSessionRequired"]);
const FreshSessionRequiredResponse = toApiErrorResponse(["FreshSessionRequired"]);
const TokenNotFoundResponse = toApiErrorResponse(["ApiTokenNotFound"]);

export default new Elysia({ prefix: "/api-tokens" })
	.use(session)
	.get(
		"",
		async ({ request }) => {
			const result = await auth.api.listApiKeys({
				headers: request.headers,
				query: { sortBy: "createdAt", sortDirection: "desc" },
			});
			return {
				items: result.apiKeys.map((key) => ({
					id: key.id,
					name: key.name ?? "",
					tokenPrefix: key.start ?? key.prefix ?? "",
					permissions: fromApiKeyPermissions(key.permissions),
					enabled: key.enabled,
					expiresAt: key.expiresAt,
					lastUsedAt: key.lastRequest,
					createdAt: key.createdAt,
					updatedAt: key.updatedAt,
				})),
			};
		},
		{
			access: "fresh-session-only",
			response: {
				[StatusCodes.OK]: ApiTokenListResponse,
				[StatusCodes.UNAUTHORIZED]: InteractiveSessionRequiredResponse,
				[StatusCodes.FORBIDDEN]: FreshSessionRequiredResponse,
			},
			detail: { summary: "List API tokens", tags: ["API Tokens"] },
		},
	)
	.post(
		"",
		async ({ user, body }) => {
			const created = await auth.api.createApiKey({
				body: {
					name: body.name,
					userId: user.id,
					expiresIn: (body.expiresInDays ?? 90) * 24 * 60 * 60,
					permissions: toApiKeyPermissions(body.permissions),
				},
			});
			return {
				id: created.id,
				name: created.name ?? body.name,
				token: created.key,
				tokenPrefix: created.start ?? created.prefix ?? "",
				permissions: fromApiKeyPermissions(created.permissions),
				enabled: created.enabled,
				expiresAt: created.expiresAt,
				lastUsedAt: created.lastRequest,
				createdAt: created.createdAt,
				updatedAt: created.updatedAt,
			};
		},
		{
			access: "fresh-session-only",
			body: CreateApiTokenBody,
			response: {
				[StatusCodes.OK]: CreatedApiTokenResponse,
				[StatusCodes.UNAUTHORIZED]: InteractiveSessionRequiredResponse,
				[StatusCodes.FORBIDDEN]: FreshSessionRequiredResponse,
			},
			detail: { summary: "Create API token (secret returned once)", tags: ["API Tokens"] },
		},
	)
	.patch(
		"/:tokenId",
		async ({ user, params, body, request }) => {
			const listed = await auth.api.listApiKeys({ headers: request.headers });
			if (!listed.apiKeys.some((key) => key.id === params.tokenId))
				throw new ApiTokenNotFound();
			const updated = await auth.api.updateApiKey({
				body: {
					keyId: params.tokenId,
					userId: user.id,
					name: body.name,
					permissions: body.permissions
						? toApiKeyPermissions(body.permissions)
						: undefined,
					expiresIn:
						body.expiresInDays === undefined
							? undefined
							: body.expiresInDays * 24 * 60 * 60,
					enabled: body.enabled,
				},
			});
			return {
				id: updated.id,
				name: updated.name ?? "",
				tokenPrefix: updated.start ?? updated.prefix ?? "",
				permissions: fromApiKeyPermissions(updated.permissions),
				enabled: updated.enabled,
				expiresAt: updated.expiresAt,
				lastUsedAt: updated.lastRequest,
				createdAt: updated.createdAt,
				updatedAt: updated.updatedAt,
			};
		},
		{
			access: "fresh-session-only",
			params: ApiTokenParams,
			body: UpdateApiTokenBody,
			response: {
				[StatusCodes.OK]: ApiTokenSummary,
				[StatusCodes.UNAUTHORIZED]: InteractiveSessionRequiredResponse,
				[StatusCodes.FORBIDDEN]: FreshSessionRequiredResponse,
				[StatusCodes.NOT_FOUND]: TokenNotFoundResponse,
			},
			detail: { summary: "Update API token", tags: ["API Tokens"] },
		},
	)
	.delete(
		"/:tokenId",
		async ({ request, params, status }) => {
			const listed = await auth.api.listApiKeys({ headers: request.headers });
			if (!listed.apiKeys.some((key) => key.id === params.tokenId))
				throw new ApiTokenNotFound();
			await auth.api.deleteApiKey({
				headers: request.headers,
				body: { keyId: params.tokenId },
			});
			return status(StatusCodes.NO_CONTENT, undefined);
		},
		{
			access: "fresh-session-only",
			params: ApiTokenParams,
			response: {
				[StatusCodes.NO_CONTENT]: t.Void(),
				[StatusCodes.UNAUTHORIZED]: InteractiveSessionRequiredResponse,
				[StatusCodes.FORBIDDEN]: FreshSessionRequiredResponse,
				[StatusCodes.NOT_FOUND]: TokenNotFoundResponse,
			},
			detail: {
				summary: "Revoke API token",
				tags: ["API Tokens"],
				responses: NoContentResponse,
			},
		},
	);
