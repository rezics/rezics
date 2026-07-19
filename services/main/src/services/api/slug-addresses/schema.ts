import { type Static, t } from "elysia";

import { GovernanceReasonCodeValues } from "../../database/schema/contract-values";
import { Uuid } from "../schema";

export const SlugLabelInput = t.String({
	minLength: 1,
	maxLength: 63,
	pattern: "^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$",
});

export const ResolveSlugAddressBody = t.Object(
	{ path: t.Array(SlugLabelInput, { minItems: 1, maxItems: 3 }) },
	{ additionalProperties: false },
);

export const ResolvedSlugAddressResponse = t.Object({
	id: Uuid,
	kind: t.String(),
	path: t.Array(SlugLabelInput, { minItems: 1, maxItems: 3 }),
	canonicalPath: t.Array(SlugLabelInput, { minItems: 1, maxItems: 3 }),
	redirected: t.Boolean(),
});

export const ReplaceOwnProfileSlugAddressBody = t.Object(
	{ slug: SlugLabelInput },
	{ additionalProperties: false },
);

export const UnitSlugAddressParams = t.Object({ unitId: Uuid });

const StaffSlugAddressInput = {
	scopeUnitId: t.Nullable(Uuid),
	slug: SlugLabelInput,
	reasonCode: t.UnionEnum(GovernanceReasonCodeValues, { default: undefined }),
};

export const ReplaceUnitSlugAddressBody = t.Object(StaffSlugAddressInput, {
	additionalProperties: false,
});

export const CreateSlugNamespaceBody = t.Object(StaffSlugAddressInput, {
	additionalProperties: false,
});

export const CanonicalSlugAddressResponse = t.Object({
	addressId: Uuid,
	unitId: Uuid,
	scopeUnitId: t.Nullable(Uuid),
	slug: SlugLabelInput,
});

export const SlugAddressMutationResponse = t.Object({
	addressId: Uuid,
	unitId: Uuid,
	scopeUnitId: t.Nullable(Uuid),
	slug: SlugLabelInput,
	redirectAddressId: t.Nullable(Uuid),
	canonicalPath: t.Array(SlugLabelInput, { minItems: 1, maxItems: 3 }),
});

export const SlugRedirectAddressParams = t.Object({ redirectAddressId: Uuid });

export const ReleaseSlugRedirectBody = t.Object(
	{
		reasonCode: t.UnionEnum(GovernanceReasonCodeValues, { default: undefined }),
	},
	{ additionalProperties: false },
);

export type ResolveSlugAddressBody = Static<typeof ResolveSlugAddressBody>;
export type ReplaceOwnProfileSlugAddressBody = Static<typeof ReplaceOwnProfileSlugAddressBody>;
export type UnitSlugAddressParams = Static<typeof UnitSlugAddressParams>;
export type ReplaceUnitSlugAddressBody = Static<typeof ReplaceUnitSlugAddressBody>;
export type CreateSlugNamespaceBody = Static<typeof CreateSlugNamespaceBody>;
export type SlugRedirectAddressParams = Static<typeof SlugRedirectAddressParams>;
export type ReleaseSlugRedirectBody = Static<typeof ReleaseSlugRedirectBody>;
