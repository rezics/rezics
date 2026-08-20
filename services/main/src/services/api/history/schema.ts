import { type Static, t } from "elysia";
import { ResourceVisibilityValues, UnitStatusValues } from "../../database/schema/contract-values";
import { RevisionHiddenFieldValues } from "../../history/visibility";
import { UnitRevisionChangeTags } from "../../units/history";
import { ResourceSectionValues } from "../../units/resource-section";
import {
	ContentLanguage,
	DateTime,
	LocalizationLanguageQuery,
	RevisionContext,
	RevisionPrimaryContribution,
	Uuid,
} from "../schema";
import { NullablePublicSlugAddressResponse } from "../slug-addresses/schema";
import { GovernanceRuleReferences } from "../governance/schema";

export const UnitHistoryParams = t.Object({ unitId: Uuid });
export const UnitRevisionParams = t.Object({ revisionId: Uuid });
export const UnitRevisionActionParams = t.Object({ unitId: Uuid, revisionId: Uuid });

export const UnitHistoryQuery = t.Object({
	cursor: t.Optional(t.String({ maxLength: 512 })),
	limit: t.Optional(t.Integer({ minimum: 1, maximum: 100, default: 30 })),
});

export const UnitRevisionCompareQuery = t.Object({ from: Uuid, to: Uuid });

export const RevisionFeedQuery = t.Object({
	cursor: t.Optional(t.String({ maxLength: 512 })),
	limit: t.Optional(t.Integer({ minimum: 1, maximum: 100, default: 30 })),
	tag: t.Optional(t.Union(UnitRevisionChangeTags.map((value) => t.Literal(value)))),
	minor: t.Optional(t.BooleanString()),
});

export const RevisionContributionParams = t.Object({ profileId: Uuid });

export const ContributionResourceKindValues = ["all", "created", "contributed"] as const;
export const ContributionResourceKind = t.UnionEnum(ContributionResourceKindValues, {
	default: "all",
});
export const ContributionResourceSection = t.UnionEnum(ResourceSectionValues, {
	default: undefined,
});

export const ContributionResourceListQuery = t.Object(
	{
		section: ContributionResourceSection,
		kind: t.Optional(ContributionResourceKind),
		...LocalizationLanguageQuery,
		cursor: t.Optional(t.String({ maxLength: 1_024 })),
		limit: t.Optional(t.Integer({ minimum: 1, maximum: 100, default: 30 })),
	},
	{ additionalProperties: false },
);
export type ContributionResourceListQuery = Static<typeof ContributionResourceListQuery>;

export const ContributionResourceListResponse = t.Object({
	items: t.Array(
		t.Object({
			id: Uuid,
			slugAddress: NullablePublicSlugAddressResponse,
			section: ContributionResourceSection,
			language: ContentLanguage,
			title: t.Nullable(t.String()),
			cover: t.Nullable(t.Object({ id: Uuid, url: t.String() })),
			status: t.UnionEnum(UnitStatusValues),
			visibility: t.UnionEnum(ResourceVisibilityValues),
			createdResourceAt: t.Nullable(DateTime),
			firstContributedAt: t.Nullable(DateTime),
			lastContributedAt: t.Nullable(DateTime),
			contributionCount: t.Integer({ minimum: 0 }),
			lastParticipatedAt: DateTime,
			createdAt: DateTime,
			updatedAt: DateTime,
		}),
	),
	nextCursor: t.Nullable(t.String()),
});

export const RevisionActionBody = t.Object(
	{
		baseRevisionId: Uuid,
		editSummary: t.Optional(t.String({ maxLength: 500 })),
		minor: t.Optional(t.Boolean({ default: false })),
		revisionContext: t.Optional(RevisionContext),
	},
	{ additionalProperties: false },
);

const RestrictedRevisionVisibility = (kind: "hidden" | "suppressed") =>
	t.Object(
		{
			kind: t.Literal(kind),
			hiddenFields: t.Array(t.UnionEnum(RevisionHiddenFieldValues), {
				minItems: 1,
				maxItems: RevisionHiddenFieldValues.length,
				uniqueItems: true,
			}),
		},
		{ additionalProperties: false },
	);

export const RevisionVisibility = t.Union([
	t.Object({ kind: t.Literal("visible") }, { additionalProperties: false }),
	RestrictedRevisionVisibility("hidden"),
	RestrictedRevisionVisibility("suppressed"),
]);

export const RevisionVisibilityBody = t.Object(
	{
		visibility: RevisionVisibility,
		rules: GovernanceRuleReferences,
	},
	{ additionalProperties: false },
);

export const UnitRevisionSummaryResponse = t.Object({
	id: Uuid,
	unitId: Uuid,
	parentRevisionId: t.Nullable(Uuid),
	actorProfileId: t.Nullable(Uuid),
	actorName: t.Nullable(t.String()),
	primaryContribution: RevisionPrimaryContribution,
	editSummary: t.Nullable(t.String()),
	minor: t.Boolean(),
	byteSize: t.Integer(),
	sizeDelta: t.Integer(),
	createdAt: DateTime,
	tags: t.Array(t.String()),
	visibility: RevisionVisibility,
	contentAvailable: t.Boolean(),
	parentContentAvailable: t.Boolean(),
	isCurrent: t.Boolean(),
});

export const UnitHistoryResponse = t.Object({
	items: t.Array(UnitRevisionSummaryResponse),
	nextCursor: t.Nullable(t.String()),
});

export const UnitScopedHistoryResponse = t.Intersect([
	UnitHistoryResponse,
	t.Object({
		capabilities: t.Object({
			canRestore: t.Boolean(),
			canModerate: t.Boolean(),
			canSuppress: t.Boolean(),
		}),
	}),
]);

const RevisionSlotContentResponse = {
	model: t.String(),
	originRevisionId: Uuid,
	content: t.Nullable(t.Unknown()),
};

export const RevisionSlotResponse = t.Union([
	t.Object({
		role: t.Union([
			t.Literal("main"),
			t.Literal("content_language_support"),
			t.Literal("relations"),
			t.Literal("structure"),
			t.Literal("rules"),
		]),
		...RevisionSlotContentResponse,
	}),
	t.Object({
		role: t.Literal("localization"),
		language: ContentLanguage,
		...RevisionSlotContentResponse,
	}),
]);

export const UnitRevisionResponse = t.Intersect([
	UnitRevisionSummaryResponse,
	t.Object({ slots: t.Array(RevisionSlotResponse) }),
]);

export const RevisionChangeResponse = t.Object({
	path: t.String(),
	before: t.Optional(t.Unknown()),
	after: t.Optional(t.Unknown()),
});

export const UnitRevisionCompareResponse = t.Object({
	fromRevisionId: Uuid,
	toRevisionId: Uuid,
	changes: t.Array(RevisionChangeResponse),
});

export const RevisionActionResponse = t.Object({
	unitId: Uuid,
	revisionId: Uuid,
	revisionCreated: t.Boolean(),
});

export const ChangeTagListResponse = t.Object({
	items: t.Array(t.Object({ tag: t.String() })),
});

export type UnitHistoryQuery = Static<typeof UnitHistoryQuery>;
