import { StatusCodes } from "http-status-codes";

import Elysia, { t } from "elysia";

import { fromApiKeyPermissions, toApiKeyPermissions } from "../../auth/api-permissions";
import { ApiTokenPolicyDocumentInvalid } from "../../auth/api-token/policy-schema";
import {
	bindStandardPolicyToToken,
	replaceTokenPolicyOverride,
	resolveApiTokenPolicy,
	type ResolvedApiTokenPolicy,
} from "../../auth/api-token/policy-service";
import session from "../../auth/session";
import { auth } from "../../auth";
import { database } from "../../database";
import { auditEvent } from "../../database/schema";
import { NoContentResponse } from "../schema/action-response";
import { toApiErrorResponse } from "../schema/response";
import { ApiTokenNotFound, ApiTokenPolicyInvalid, ApiTokenPolicyRevisionConflict } from "./errors";
import {
	ApiTokenListResponse,
	ApiTokenParams,
	ApiTokenSummary,
	CreatedApiTokenResponse,
	CreateApiTokenBody,
	ReplaceApiTokenPolicyBody,
	UpdateApiTokenBody,
} from "./schema";

const InteractiveSessionRequiredResponse = toApiErrorResponse(["InteractiveSessionRequired"]);
const FreshSessionRequiredResponse = toApiErrorResponse(["FreshSessionRequired"]);
const TokenNotFoundResponse = toApiErrorResponse(["ApiTokenNotFound"]);
const TokenPolicyInvalidResponse = toApiErrorResponse(["ApiTokenPolicyInvalid"]);
const TokenPolicyRevisionConflictResponse = toApiErrorResponse(["ApiTokenPolicyRevisionConflict"]);

type BetterAuthApiKey = Awaited<ReturnType<typeof auth.api.listApiKeys>>["apiKeys"][number];

function presentPolicy(policy: ResolvedApiTokenPolicy) {
	return {
		key: policy.key,
		kind: policy.kind,
		source: policy.source,
		schemaVersion: policy.schemaVersion,
		policyRevision: policy.policyRevision,
		bindingRevision: policy.bindingRevision,
		validUntil: policy.validUntil,
		limits: policy.configuration.limits,
		operations: policy.configuration.operations,
	};
}

function presentToken(key: BetterAuthApiKey, policy: ResolvedApiTokenPolicy) {
	return {
		id: key.id,
		name: key.name ?? "",
		tokenPrefix: key.start ?? key.prefix ?? "",
		permissions: fromApiKeyPermissions(key.permissions),
		enabled: key.enabled,
		expiresAt: key.expiresAt,
		lastUsedAt: key.lastRequest,
		createdAt: key.createdAt,
		updatedAt: key.updatedAt,
		policy: presentPolicy(policy),
	};
}

async function findOwnedToken(request: Request, tokenId: string) {
	const listed = await auth.api.listApiKeys({ headers: request.headers });
	const key = listed.apiKeys.find((candidate) => candidate.id === tokenId);
	if (!key) throw new ApiTokenNotFound();
	return key;
}

export default new Elysia({ prefix: "/api-tokens" })
	.use(session)
	.get(
		"",
		async ({ request }) => {
			const result = await auth.api.listApiKeys({
				headers: request.headers,
				query: { sortBy: "createdAt", sortDirection: "desc" },
			});
			const policies = await Promise.all(
				result.apiKeys.map((key) => resolveApiTokenPolicy(key.id)),
			);
			return {
				items: result.apiKeys.map((key, index) => {
					const policy = policies[index];
					if (!policy) throw new Error(`Missing resolved policy for API token ${key.id}`);
					return presentToken(key, policy);
				}),
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
		async ({ user, profile, body, request }) => {
			const created = await auth.api.createApiKey({
				body: {
					name: body.name,
					userId: user.id,
					expiresIn: (body.expiresInDays ?? 90) * 24 * 60 * 60,
					permissions: toApiKeyPermissions(body.permissions),
				},
			});
			try {
				await database.transaction(async (tx) => {
					await bindStandardPolicyToToken(tx, {
						tokenId: created.id,
						actorProfileId: profile.unitId,
						override: body.policyOverride,
					});
					await tx.insert(auditEvent).values({
						actorProfileId: profile.unitId,
						action: "api_token.create",
						decisionCode: "allowed",
						subjectKind: "api_token",
						subjectId: created.id,
						metadata: { permissions: body.permissions },
					});
				});
			} catch (error) {
				await auth.api.deleteApiKey({
					headers: request.headers,
					body: { keyId: created.id },
				});
				if (error instanceof ApiTokenPolicyDocumentInvalid)
					throw new ApiTokenPolicyInvalid();
				throw error;
			}
			const policy = await resolveApiTokenPolicy(created.id);
			return { ...presentToken(created, policy), token: created.key };
		},
		{
			access: "fresh-session-only",
			body: CreateApiTokenBody,
			response: {
				[StatusCodes.OK]: CreatedApiTokenResponse,
				[StatusCodes.UNAUTHORIZED]: InteractiveSessionRequiredResponse,
				[StatusCodes.FORBIDDEN]: FreshSessionRequiredResponse,
				[StatusCodes.UNPROCESSABLE_ENTITY]: TokenPolicyInvalidResponse,
			},
			detail: { summary: "Create API token (secret returned once)", tags: ["API Tokens"] },
		},
	)
	.patch(
		"/:tokenId",
		async ({ user, profile, params, body, request }) => {
			await findOwnedToken(request, params.tokenId);
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
			await database.insert(auditEvent).values({
				actorProfileId: profile.unitId,
				action: "api_token.update",
				decisionCode: "allowed",
				subjectKind: "api_token",
				subjectId: params.tokenId,
				metadata: {
					nameChanged: body.name !== undefined,
					permissionsChanged: body.permissions !== undefined,
					expiryChanged: body.expiresInDays !== undefined,
					enabledChanged: body.enabled !== undefined,
				},
			});
			return presentToken(updated, await resolveApiTokenPolicy(updated.id));
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
	.put(
		"/:tokenId/policy",
		async ({ profile, params, body, request }) => {
			const key = await findOwnedToken(request, params.tokenId);
			try {
				const policy = await database.transaction(async (tx) => {
					const replaced = await replaceTokenPolicyOverride(tx, {
						tokenId: params.tokenId,
						actorProfileId: profile.unitId,
						expectedRevision: body.expectedRevision,
						override: body.configurationOverride,
					});
					if (!replaced) throw new ApiTokenPolicyRevisionConflict();
					await tx.insert(auditEvent).values({
						actorProfileId: profile.unitId,
						action: "api_token.policy_override.replace",
						decisionCode: "allowed",
						subjectKind: "api_token",
						subjectId: params.tokenId,
						metadata: {
							policyKey: replaced.key,
							bindingRevision: replaced.bindingRevision,
						},
					});
					return replaced;
				});
				return presentToken(key, policy);
			} catch (error) {
				if (error instanceof ApiTokenPolicyDocumentInvalid)
					throw new ApiTokenPolicyInvalid();
				throw error;
			}
		},
		{
			access: "fresh-session-only",
			params: ApiTokenParams,
			body: ReplaceApiTokenPolicyBody,
			response: {
				[StatusCodes.OK]: ApiTokenSummary,
				[StatusCodes.UNAUTHORIZED]: InteractiveSessionRequiredResponse,
				[StatusCodes.FORBIDDEN]: FreshSessionRequiredResponse,
				[StatusCodes.NOT_FOUND]: TokenNotFoundResponse,
				[StatusCodes.CONFLICT]: TokenPolicyRevisionConflictResponse,
				[StatusCodes.UNPROCESSABLE_ENTITY]: TokenPolicyInvalidResponse,
			},
			detail: { summary: "Replace API token policy override", tags: ["API Tokens"] },
		},
	)
	.delete(
		"/:tokenId",
		async ({ request, profile, params, status }) => {
			await findOwnedToken(request, params.tokenId);
			await auth.api.deleteApiKey({
				headers: request.headers,
				body: { keyId: params.tokenId },
			});
			await database.insert(auditEvent).values({
				actorProfileId: profile.unitId,
				action: "api_token.revoke",
				decisionCode: "allowed",
				subjectKind: "api_token",
				subjectId: params.tokenId,
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
