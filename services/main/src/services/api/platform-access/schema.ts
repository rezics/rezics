import { PlatformCapabilityValues } from "@rezics/access";
import { type Static, t } from "elysia";

import { DateTime, Uuid } from "../schema";

export const PlatformCapability = t.UnionEnum(PlatformCapabilityValues);

export const PlatformAccessGrantResponse = t.Object({
	id: Uuid,
	capability: PlatformCapability,
	grantedByProfileId: Uuid,
	expiresAt: t.Nullable(DateTime),
	createdAt: DateTime,
	updatedAt: DateTime,
});

export const PlatformAccessProfileResponse = t.Object({
	profileId: Uuid,
	name: t.Nullable(t.String()),
	email: t.String({ format: "email" }),
	grants: t.Array(PlatformAccessGrantResponse),
	revision: t.String({ minLength: 1 }),
});

export const PlatformAccessProfileListResponse = t.Object({
	items: t.Array(PlatformAccessProfileResponse),
});

export const PlatformAccessPolicyResponse = t.Object({
	capabilities: t.Array(PlatformCapability, { uniqueItems: true }),
});

export const PlatformAccessProfilesQuery = t.Object(
	{
		query: t.Optional(t.String({ minLength: 1, maxLength: 200 })),
		limit: t.Optional(t.Integer({ minimum: 1, maximum: 100, default: 50 })),
	},
	{ additionalProperties: false },
);

export const PlatformAccessProfileParams = t.Object({ profileId: Uuid });

export const CustomThemeExternalLiveAccessGrantResponse = t.Object({
	id: Uuid,
	state: t.UnionEnum(["granted", "expired"] as const),
	grantedByProfileId: Uuid,
	expiresAt: DateTime,
	createdAt: DateTime,
	updatedAt: DateTime,
});

export const CustomThemeExternalLiveAccessProfileResponse = t.Object({
	profileId: Uuid,
	name: t.Nullable(t.String()),
	email: t.String({ format: "email" }),
	grant: t.Nullable(CustomThemeExternalLiveAccessGrantResponse),
	revision: t.String({ minLength: 1 }),
});

export const CustomThemeExternalLiveAccessProfileListResponse = t.Object({
	items: t.Array(CustomThemeExternalLiveAccessProfileResponse),
});

export const SetCustomThemeExternalLiveAccessBody = t.Union([
	t.Object(
		{
			expectedRevision: t.String({ minLength: 1 }),
			state: t.Literal("granted"),
			expiresAt: DateTime,
		},
		{ additionalProperties: false },
	),
	t.Object(
		{
			expectedRevision: t.String({ minLength: 1 }),
			state: t.Literal("revoked"),
		},
		{ additionalProperties: false },
	),
]);

export const ReplacePlatformAccessBody = t.Object(
	{
		expectedRevision: t.String({ minLength: 1 }),
		grants: t.Array(
			t.Object(
				{
					capability: PlatformCapability,
					expiresAt: t.Nullable(DateTime),
				},
				{ additionalProperties: false },
			),
			{
				maxItems: PlatformCapabilityValues.length,
				uniqueItems: true,
			},
		),
	},
	{ additionalProperties: false },
);

export type ReplacePlatformAccessBody = Static<typeof ReplacePlatformAccessBody>;
export type SetCustomThemeExternalLiveAccessBody = Static<
	typeof SetCustomThemeExternalLiveAccessBody
>;
