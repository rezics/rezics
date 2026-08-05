import { t } from "elysia";

import { UserAccountStateReasonValues, UserAccountStateValues } from "../../database/schema";
import { CountResultSchema } from "../../counts/contract";
import { DateTime, Uuid } from "../schema";

export const PlatformUsersQuery = t.Object(
	{
		cursor: t.Optional(t.String({ minLength: 1, maxLength: 500 })),
		limit: t.Optional(t.Integer({ minimum: 1, maximum: 100, default: 50 })),
		search: t.Optional(t.String({ minLength: 1, maxLength: 200 })),
		state: t.Optional(t.UnionEnum(UserAccountStateValues)),
		emailVerified: t.Optional(t.Boolean()),
	},
	{ additionalProperties: false },
);

export const PlatformUserParams = t.Object({ userId: Uuid });
export const PlatformUserSessionParams = t.Object({ userId: Uuid, sessionId: Uuid });

export const PlatformUserAccountStateResponse = t.Object({
	state: t.UnionEnum(UserAccountStateValues),
	reason: t.Nullable(t.UnionEnum(UserAccountStateReasonValues)),
	note: t.Nullable(t.String()),
	expiresAt: t.Nullable(DateTime),
	revision: t.Integer({ minimum: 0 }),
	updatedAt: t.Nullable(DateTime),
	updatedByProfileId: t.Nullable(Uuid),
});

export const PlatformUserResponse = t.Object({
	userId: Uuid,
	profileId: t.Nullable(Uuid),
	name: t.String(),
	email: t.String(),
	emailVerified: t.Boolean(),
	accountState: PlatformUserAccountStateResponse,
	activeSessionCount: CountResultSchema,
	createdAt: DateTime,
	updatedAt: DateTime,
});

export const PlatformUserListResponse = t.Object({
	items: t.Array(PlatformUserResponse),
	nextCursor: t.Nullable(t.String()),
});

const AccountStateCommandBase = {
	expectedRevision: t.Integer({ minimum: 0 }),
} as const;

export const ReplacePlatformUserAccountStateBody = t.Union([
	t.Object(
		{
			...AccountStateCommandBase,
			state: t.Literal("active"),
		},
		{ additionalProperties: false },
	),
	t.Object(
		{
			...AccountStateCommandBase,
			state: t.Literal("suspended"),
			reason: t.UnionEnum(UserAccountStateReasonValues),
			note: t.Optional(t.String({ minLength: 1, maxLength: 2_000 })),
			expiresAt: t.Optional(DateTime),
		},
		{ additionalProperties: false },
	),
	t.Object(
		{
			...AccountStateCommandBase,
			state: t.Literal("closed"),
			reason: t.UnionEnum(UserAccountStateReasonValues),
			note: t.Optional(t.String({ minLength: 1, maxLength: 2_000 })),
		},
		{ additionalProperties: false },
	),
]);

export const PlatformUserSessionResponse = t.Object({
	id: Uuid,
	expiresAt: DateTime,
	createdAt: DateTime,
	updatedAt: DateTime,
	ipAddress: t.Nullable(t.String()),
	userAgent: t.Nullable(t.String()),
	current: t.Boolean(),
});

export const PlatformUserSessionListResponse = t.Object({
	items: t.Array(PlatformUserSessionResponse),
});

export const SessionRevocationResponse = t.Object({
	revokedCount: t.Integer({ minimum: 0 }),
});
