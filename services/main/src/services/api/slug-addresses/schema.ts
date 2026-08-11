import { type Static, t } from "elysia";
import { SlugAddressMaximumDepth, SlugLabelPatternSource } from "@rezics/slug";

import { UnitKind, Uuid } from "../schema";
import { GovernanceRuleReferences } from "../governance/schema";

export const SlugLabelInput = t.String({
	minLength: 1,
	maxLength: 63,
	pattern: SlugLabelPatternSource,
});

export const ResolveSlugAddressBody = t.Object(
	{
		path: t.Array(SlugLabelInput, {
			minItems: 1,
			maxItems: SlugAddressMaximumDepth,
		}),
	},
	{ additionalProperties: false },
);

export const ScopedSlugAddressParams = t.Object({
	scopeUnitId: Uuid,
	slug: SlugLabelInput,
});

export const ResolveScopedSlugAddressQuery = t.Object({
	kind: t.Optional(UnitKind),
});

export const PublicSlugAddressResponse = t.Object(
	{
		slug: SlugLabelInput,
		scopeUnitId: Uuid,
		canonicalPath: t.Array(SlugLabelInput, {
			minItems: 2,
			maxItems: SlugAddressMaximumDepth,
		}),
	},
	{ additionalProperties: false },
);

export const NullablePublicSlugAddressResponse = t.Nullable(PublicSlugAddressResponse);

export const ResolvedSlugAddressResponse = t.Object({
	id: Uuid,
	kind: UnitKind,
	path: t.Array(SlugLabelInput, {
		minItems: 1,
		maxItems: SlugAddressMaximumDepth,
	}),
	canonicalPath: t.Array(SlugLabelInput, {
		minItems: 1,
		maxItems: SlugAddressMaximumDepth,
	}),
	redirected: t.Boolean(),
});

export const ReplacePublicUnitSlugAddressBody = t.Object(
	{ slug: SlugLabelInput },
	{ additionalProperties: false },
);

export const UnitSlugAddressParams = t.Object({ unitId: Uuid });

const PlatformSlugAddressInput = {
	scopeUnitId: t.Nullable(Uuid),
	slug: SlugLabelInput,
	rules: GovernanceRuleReferences,
};

export const ReplaceUnitSlugAddressBody = t.Object(PlatformSlugAddressInput, {
	additionalProperties: false,
});

export const CreateSlugNamespaceBody = t.Object(PlatformSlugAddressInput, {
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
	canonicalPath: t.Array(SlugLabelInput, {
		minItems: 1,
		maxItems: SlugAddressMaximumDepth,
	}),
});

export const SlugRedirectAddressParams = t.Object({ redirectAddressId: Uuid });

export const ReleaseSlugRedirectBody = t.Object(
	{
		rules: GovernanceRuleReferences,
	},
	{ additionalProperties: false },
);

export type ResolveSlugAddressBody = Static<typeof ResolveSlugAddressBody>;
export type ScopedSlugAddressParams = Static<typeof ScopedSlugAddressParams>;
export type ResolveScopedSlugAddressQuery = Static<typeof ResolveScopedSlugAddressQuery>;
export type ReplacePublicUnitSlugAddressBody = Static<typeof ReplacePublicUnitSlugAddressBody>;
export type UnitSlugAddressParams = Static<typeof UnitSlugAddressParams>;
export type ReplaceUnitSlugAddressBody = Static<typeof ReplaceUnitSlugAddressBody>;
export type CreateSlugNamespaceBody = Static<typeof CreateSlugNamespaceBody>;
export type SlugRedirectAddressParams = Static<typeof SlugRedirectAddressParams>;
export type ReleaseSlugRedirectBody = Static<typeof ReleaseSlugRedirectBody>;
