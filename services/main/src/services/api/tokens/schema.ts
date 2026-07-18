import { t } from "elysia";

import { ApiPermissionValues } from "../../auth/api-permissions";
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
});

export const ApiTokenListResponse = t.Object({ items: t.Array(ApiTokenSummary) });

export const CreatedApiTokenResponse = t.Composite([
	ApiTokenSummary,
	t.Object({ token: t.String() }),
]);
