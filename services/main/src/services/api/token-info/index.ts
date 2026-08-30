import { eq } from "drizzle-orm";
import { StatusCodes } from "http-status-codes";

import Elysia, { t } from "elysia";

import { ApiPermissionValues } from "../../auth/api-permissions";
import session from "../../auth/session";
import { database } from "../../database";
import { apikeys } from "../../database/schema";
import { DateTime, Uuid } from "../schema";
import { toApiErrorResponse } from "../schema/response";
import { ApiTokenQuotaResponse } from "../tokens/schema";

const ApiPermission = t.UnionEnum(ApiPermissionValues);
const TokenInformationResponse = t.Object({
	id: Uuid,
	name: t.String(),
	tokenPrefix: t.String(),
	permissions: t.Array(ApiPermission),
	enabled: t.Boolean(),
	expiresAt: t.Nullable(DateTime),
	createdAt: DateTime,
	quota: ApiTokenQuotaResponse,
});

export default new Elysia({ prefix: "/token" }).use(session).get(
	"",
	{
		access: "api-key-only",
		response: {
			[StatusCodes.OK]: TokenInformationResponse,
			[StatusCodes.UNAUTHORIZED]: toApiErrorResponse(["AuthenticationRequired"]),
			[StatusCodes.TOO_MANY_REQUESTS]: toApiErrorResponse([
				"ApiQuotaExceeded",
				"ApiTokenRateLimitExceeded",
			]),
		},
		detail: {
			operationId: "getCurrentApiToken",
			summary: "Inspect the current API token's safe capabilities",
			tags: ["API Tokens"],
		},
	},
	async ({ credential }) => {
		if (credential.kind !== "apiKey")
			throw new Error("API token introspection requires an API-key credential");
		const [key] = await database
			.select({
				id: apikeys.id,
				name: apikeys.name,
				start: apikeys.start,
				prefix: apikeys.prefix,
				enabled: apikeys.enabled,
				expiresAt: apikeys.expiresAt,
				createdAt: apikeys.createdAt,
			})
			.from(apikeys)
			.where(eq(apikeys.id, credential.id))
			.limit(1);
		if (!key) throw new Error("Verified API token record is unavailable");
		const account = credential.accountQuotaPolicy;
		const token = credential.tokenQuotaPolicy;
		const tokenOverride = credential.tokenQuotaOverride;
		return {
			id: key.id,
			name: key.name ?? "",
			tokenPrefix: key.start ?? key.prefix ?? "",
			permissions: [...credential.permissions],
			enabled: key.enabled ?? false,
			expiresAt: key.expiresAt,
			createdAt: key.createdAt,
			quota: {
				account: {
					key: account.key,
					class: account.class,
					source: account.source,
					schemaVersion: account.schemaVersion,
					policyRevision: account.policyRevision,
					bindingRevision: account.bindingRevision,
					validUntil: account.validUntil,
					assignmentReason: account.assignmentReason,
					configurationOverride: account.configurationOverride,
					limits: account.configuration.limits,
					maxActiveTokens: account.configuration.maxActiveTokens,
					operations: account.configuration.operations,
				},
				token: {
					key: token.key,
					class: token.class,
					source: token.source,
					schemaVersion: token.schemaVersion,
					policyRevision: token.policyRevision,
					bindingRevision: token.bindingRevision,
					validUntil: token.validUntil,
					assignmentReason: token.assignmentReason,
					configurationOverride: token.configurationOverride,
					limits: token.configuration.limits,
					operations: token.configuration.operations,
				},
				tokenOverride: tokenOverride
					? {
							configurationOverride: tokenOverride.configurationOverride,
							revision: tokenOverride.revision,
							updatedAt: tokenOverride.updatedAt,
						}
					: null,
			},
		};
	},
);
