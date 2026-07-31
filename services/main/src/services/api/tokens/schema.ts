import { t } from "elysia";

import { ApiPermissionValues } from "../../auth/api-permissions";
import {
	PrivilegedApiAccountQuotaOverride,
	ApiTokenQuotaOverrideInput,
	PrivilegedApiQuotaLimits,
	PrivilegedApiQuotaOperations,
} from "../../auth/api-quota/policy-schema";
import { ApiQuotaPolicyClassValues } from "../../database/schema";
import { DateTime, Uuid } from "../schema";

const ApiPermission = t.UnionEnum(ApiPermissionValues);

export const CreateApiTokenBody = t.Object({
	name: t.String({ minLength: 1, maxLength: 120 }),
	permissions: t.Array(ApiPermission, {
		minItems: 1,
		maxItems: ApiPermissionValues.length,
		uniqueItems: true,
	}),
	expiresInDays: t.Optional(t.Integer({ minimum: 1, maximum: 365, default: 90 })),
});

export const UpdateApiTokenBody = t.Object(
	{
		name: t.Optional(t.String({ minLength: 1, maxLength: 120 })),
		permissions: t.Optional(
			t.Array(ApiPermission, {
				minItems: 1,
				maxItems: ApiPermissionValues.length,
				uniqueItems: true,
			}),
		),
		expiresInDays: t.Optional(t.Integer({ minimum: 1, maximum: 365 })),
		enabled: t.Optional(t.Boolean()),
	},
	{ minProperties: 1 },
);

export const ApiTokenParams = t.Object({ tokenId: Uuid });

export const ApiAccountQuotaPolicyResponse = t.Object({
	key: t.String(),
	class: t.UnionEnum(ApiQuotaPolicyClassValues),
	source: t.UnionEnum(["assigned", "standard_default", "privileged_fallback"]),
	schemaVersion: t.Integer({ minimum: 1 }),
	policyRevision: t.Integer({ minimum: 1 }),
	bindingRevision: t.Nullable(t.Integer({ minimum: 1 })),
	validUntil: t.Nullable(DateTime),
	assignmentReason: t.Nullable(t.String()),
	configurationOverride: PrivilegedApiAccountQuotaOverride,
	limits: PrivilegedApiQuotaLimits,
	maxActiveTokens: t.Integer({ minimum: 1 }),
	operations: PrivilegedApiQuotaOperations,
});

export const ApiTokenQuotaPolicyResponse = t.Object({
	key: t.String(),
	class: t.UnionEnum(ApiQuotaPolicyClassValues),
	source: t.UnionEnum(["assigned", "standard_default", "privileged_fallback"]),
	schemaVersion: t.Integer({ minimum: 1 }),
	policyRevision: t.Integer({ minimum: 1 }),
	bindingRevision: t.Nullable(t.Integer({ minimum: 1 })),
	validUntil: t.Nullable(DateTime),
	assignmentReason: t.Nullable(t.String()),
	configurationOverride: ApiTokenQuotaOverrideInput,
	limits: PrivilegedApiQuotaLimits,
	operations: PrivilegedApiQuotaOperations,
});

export const ApiTokenQuotaOverrideResponse = t.Nullable(
	t.Object({
		configurationOverride: ApiTokenQuotaOverrideInput,
		revision: t.Integer({ minimum: 1 }),
		updatedAt: DateTime,
	}),
);

export const ApiTokenQuotaResponse = t.Object({
	account: ApiAccountQuotaPolicyResponse,
	token: ApiTokenQuotaPolicyResponse,
	tokenOverride: ApiTokenQuotaOverrideResponse,
});

export const ReplaceApiTokenQuotaOverrideBody = t.Object(
	{
		expectedRevision: t.Integer({ minimum: 0 }),
		configurationOverride: ApiTokenQuotaOverrideInput,
	},
	{ additionalProperties: false },
);

export const DeleteApiTokenQuotaOverrideBody = t.Object(
	{ expectedRevision: t.Integer({ minimum: 1 }) },
	{ additionalProperties: false },
);

export const ApiTokenSummary = t.Object({
	id: Uuid,
	name: t.String(),
	tokenPrefix: t.String(),
	permissions: t.Array(ApiPermission),
	enabled: t.Boolean(),
	expiresAt: t.Nullable(DateTime),
	lastUsedAt: t.Nullable(DateTime),
	createdAt: DateTime,
	updatedAt: DateTime,
	quota: ApiTokenQuotaResponse,
});

export const ApiTokenListResponse = t.Object({
	itemLimit: t.Integer({ minimum: 1 }),
	items: t.Array(ApiTokenSummary),
});

export const CreatedApiTokenResponse = t.Composite([
	ApiTokenSummary,
	t.Object({ token: t.String() }),
]);
