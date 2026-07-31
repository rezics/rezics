import { type Static, t } from "elysia";
import { GovernanceReasonCodeValues } from "../../database/schema/contract-values";
import { RevisionHiddenFieldValues } from "../../history/visibility";
import { UnitRevisionChangeTags } from "../../units/history";
import { ContentLanguage, DateTime, Uuid } from "../schema";

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

export const RevisionActionBody = t.Object(
	{
		baseRevisionId: Uuid,
		editSummary: t.Optional(t.String({ maxLength: 500 })),
		minor: t.Optional(t.Boolean({ default: false })),
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
		reasonCode: t.UnionEnum(GovernanceReasonCodeValues, { default: undefined }),
	},
	{ additionalProperties: false },
);

export const UnitRevisionSummaryResponse = t.Object({
	id: Uuid,
	unitId: Uuid,
	parentRevisionId: t.Nullable(Uuid),
	actorProfileId: t.Nullable(Uuid),
	actorName: t.Nullable(t.String()),
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
