import type { StaticDecode } from "typebox";
import { t } from "elysia";
import { SlugAddressMaximumDepth, SlugLabelPatternSource } from "@rezics/slug";

import { RevisionContext, UnitKind, Uuid } from "../schema";
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

export const CreateSlugNamespaceBody = t.Object(
	{ ...PlatformSlugAddressInput, revisionContext: t.Optional(RevisionContext) },
	{
		additionalProperties: false,
	},
);

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

export type ResolveSlugAddressBody = StaticDecode<typeof ResolveSlugAddressBody>;
export type ScopedSlugAddressParams = StaticDecode<typeof ScopedSlugAddressParams>;
export type ResolveScopedSlugAddressQuery = StaticDecode<typeof ResolveScopedSlugAddressQuery>;
export type ReplacePublicUnitSlugAddressBody = StaticDecode<
	typeof ReplacePublicUnitSlugAddressBody
>;
export type UnitSlugAddressParams = StaticDecode<typeof UnitSlugAddressParams>;
export type ReplaceUnitSlugAddressBody = StaticDecode<typeof ReplaceUnitSlugAddressBody>;
export type CreateSlugNamespaceBody = StaticDecode<typeof CreateSlugNamespaceBody>;
export type SlugRedirectAddressParams = StaticDecode<typeof SlugRedirectAddressParams>;
export type ReleaseSlugRedirectBody = StaticDecode<typeof ReleaseSlugRedirectBody>;
