import { StatusCodes } from "http-status-codes";
import { createHash, randomBytes } from "node:crypto";

import { and, desc, eq, isNull } from "drizzle-orm";
import Elysia, { t } from "elysia";

import session from "../../auth/session";
import { database } from "../../database";
import { apiToken } from "../../database/schema";
import { NoContentResponse } from "../schema/action-response";
import { toApiErrorResponse } from "../schema/response";
import {
	ApiTokenListResponse,
	ApiTokenParams,
	CreatedApiTokenResponse,
	CreateApiTokenBody,
} from "./schema";
import { ApiTokenExpiryInvalid, ApiTokenNotFound, ApiTokenReadScopeRequired } from "./errors";

const AuthenticationRequiredResponse = toApiErrorResponse(["AuthenticationRequired"]);
const TokenWriteForbiddenResponse = toApiErrorResponse([
	"ApiTokenScopeRequired",
	"EmailVerificationRequired",
	"AccountRestricted",
]);
const InvalidTokenResponse = toApiErrorResponse([
	"ApiTokenReadScopeRequired",
	"ApiTokenExpiryInvalid",
]);
const TokenNotFoundResponse = toApiErrorResponse(["ApiTokenNotFound"]);

export default new Elysia({ prefix: "/api-tokens" })
	.use(session)
	.get(
		"",
		async ({ profile }) => ({
			items: await database
				.select({
					id: apiToken.id,
					name: apiToken.name,
					tokenPrefix: apiToken.prefix,
					scopes: apiToken.scopes,
					expiresAt: apiToken.expiresAt,
					lastUsedAt: apiToken.lastUsedAt,
					revokedAt: apiToken.revokedAt,
					createdAt: apiToken.createdAt,
					updatedAt: apiToken.updatedAt,
				})
				.from(apiToken)
				.where(eq(apiToken.profileId, profile.unitId))
				.orderBy(desc(apiToken.createdAt), desc(apiToken.id)),
		}),
		{
			auth: true,
			response: { [StatusCodes.OK]: ApiTokenListResponse },
			detail: { summary: "List API tokens", tags: ["API Tokens"] },
		},
	)
	.post(
		"",
		async ({ profile, body }) => {
			if (!body.scopes.some((scope) => scope === "read"))
				throw new ApiTokenReadScopeRequired();
			const expiresAt = body.expiresAt ? new Date(body.expiresAt) : null;
			if (expiresAt && expiresAt <= new Date()) throw new ApiTokenExpiryInvalid();
			const raw = `rz_${randomBytes(32).toString("base64url")}`;
			const tokenPrefix = raw.slice(0, 14);
			const tokenHash = createHash("sha256").update(raw).digest("hex");
			const [created] = await database
				.insert(apiToken)
				.values({
					profileId: profile.unitId,
					name: body.name,
					prefix: tokenPrefix,
					tokenHash,
					scopes: body.scopes,
					expiresAt,
				})
				.returning({
					id: apiToken.id,
					name: apiToken.name,
					tokenPrefix: apiToken.prefix,
					scopes: apiToken.scopes,
					expiresAt: apiToken.expiresAt,
					createdAt: apiToken.createdAt,
				});
			if (!created) throw new Error("API token insert did not return a row");
			return { ...created, token: raw };
		},
		{
			write: true,
			body: CreateApiTokenBody,
			response: {
				[StatusCodes.OK]: CreatedApiTokenResponse,
				[StatusCodes.BAD_REQUEST]: InvalidTokenResponse,
				[StatusCodes.UNAUTHORIZED]: AuthenticationRequiredResponse,
				[StatusCodes.FORBIDDEN]: TokenWriteForbiddenResponse,
			},
			detail: { summary: "Create API token (secret returned once)", tags: ["API Tokens"] },
		},
	)
	.delete(
		"/:tokenId",
		async ({ profile, params, status }) => {
			const [revoked] = await database
				.update(apiToken)
				.set({ revokedAt: new Date() })
				.where(
					and(
						eq(apiToken.id, params.tokenId),
						eq(apiToken.profileId, profile.unitId),
						isNull(apiToken.revokedAt),
					),
				)
				.returning({ id: apiToken.id });
			if (!revoked) throw new ApiTokenNotFound();
			return status(StatusCodes.NO_CONTENT, undefined);
		},
		{
			write: true,
			params: ApiTokenParams,
			response: {
				[StatusCodes.NO_CONTENT]: t.Void(),
				[StatusCodes.UNAUTHORIZED]: AuthenticationRequiredResponse,
				[StatusCodes.FORBIDDEN]: TokenWriteForbiddenResponse,
				[StatusCodes.NOT_FOUND]: TokenNotFoundResponse,
			},
			detail: {
				summary: "Revoke API token",
				tags: ["API Tokens"],
				responses: NoContentResponse,
			},
		},
	);
