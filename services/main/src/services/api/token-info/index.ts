import { eq } from "drizzle-orm";
import { StatusCodes } from "http-status-codes";

import Elysia, { t } from "elysia";

import { ApiPermissionValues } from "../../auth/api-permissions";
import session from "../../auth/session";
import { database } from "../../database";
import { apikeys } from "../../database/schema";
import { DateTime, Uuid } from "../schema";
import { toApiErrorResponse } from "../schema/response";
import { ApiTokenPolicy } from "../tokens/schema";

const ApiPermission = t.UnionEnum(ApiPermissionValues);
const TokenInformationResponse = t.Object({
	id: Uuid,
	name: t.String(),
	tokenPrefix: t.String(),
	permissions: t.Array(ApiPermission),
	enabled: t.Boolean(),
	expiresAt: t.Nullable(DateTime),
	createdAt: DateTime,
	policy: ApiTokenPolicy,
});

export default new Elysia({ prefix: "/token" }).use(session).get(
	"",
	async ({ credential }) => {
		if (credential.kind !== "apiKey")
			throw new Error("API token introspection requires an API-key credential");
		const apiCredential = credential;
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
			.where(eq(apikeys.id, apiCredential.id))
			.limit(1);
		if (!key) throw new Error("Verified API token record is unavailable");
		const policy = apiCredential.policy;
		return {
			id: key.id,
			name: key.name ?? "",
			tokenPrefix: key.start ?? key.prefix ?? "",
			permissions: [...apiCredential.permissions],
			enabled: key.enabled ?? false,
			expiresAt: key.expiresAt,
			createdAt: key.createdAt,
			policy: {
				key: policy.key,
				kind: policy.kind,
				source: policy.source,
				schemaVersion: policy.schemaVersion,
				policyRevision: policy.policyRevision,
				bindingRevision: policy.bindingRevision,
				validUntil: policy.validUntil,
				limits: policy.configuration.limits,
				operations: policy.configuration.operations,
			},
		};
	},
	{
		access: "api-key-only",
		response: {
			[StatusCodes.OK]: TokenInformationResponse,
			[StatusCodes.UNAUTHORIZED]: toApiErrorResponse(["AuthenticationRequired"]),
			[StatusCodes.TOO_MANY_REQUESTS]: toApiErrorResponse(["ApiTokenRateLimitExceeded"]),
		},
		detail: {
			operationId: "getCurrentApiToken",
			summary: "Inspect the current API token's safe capabilities",
			tags: ["API Tokens"],
		},
	},
);
