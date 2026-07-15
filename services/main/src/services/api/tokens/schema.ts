import { t } from "elysia";

import { ApiTokenScopeValues } from "../../database/schema/contract-values";
import { DateTime, Uuid } from "../schema";

const ApiTokenScope = t.Union(ApiTokenScopeValues.map((value) => t.Literal(value)));

export const CreateApiTokenBody = t.Object({
	name: t.String({ minLength: 1, maxLength: 120 }),
	scopes: t.Array(ApiTokenScope, { minItems: 1, maxItems: 5, uniqueItems: true }),
	expiresAt: t.Optional(t.Nullable(t.String({ format: "date-time" }))),
});

export const ApiTokenParams = t.Object({ tokenId: Uuid });

export const ApiTokenListResponse = t.Object({
	items: t.Array(
		t.Object({
			id: Uuid,
			name: t.String(),
			tokenPrefix: t.String(),
			scopes: t.Array(t.String()),
			expiresAt: t.Nullable(DateTime),
			lastUsedAt: t.Nullable(DateTime),
			revokedAt: t.Nullable(DateTime),
			createdAt: DateTime,
			updatedAt: DateTime,
		}),
	),
});

export const CreatedApiTokenResponse = t.Object({
	id: Uuid,
	name: t.String(),
	token: t.String(),
	tokenPrefix: t.String(),
	scopes: t.Array(t.String()),
	expiresAt: t.Nullable(DateTime),
	createdAt: DateTime,
});
