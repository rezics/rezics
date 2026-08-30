import type { StaticDecode } from "typebox";
import { t } from "elysia";
import { PortableTextDocument } from "@rezics/block";

import {
	ContentLanguage,
	LocalizationLanguageQuery,
	RevisionContext,
	ResourceVisibility,
	Uuid,
} from "../schema";
import { PostPublishRealmIds } from "../posts/schema";

export const ReviewSortValues = ["best", "new"] as const;
export const ReviewSortSchema = t.UnionEnum(ReviewSortValues, { default: "best" });
export type ReviewSort = StaticDecode<typeof ReviewSortSchema>;

const ListReviewsCommonQuery = {
	targetId: t.Optional(Uuid),
	realmIds: t.Optional(t.Array(Uuid, { minItems: 1, maxItems: 50, uniqueItems: true })),
	languages: t.Optional(t.Array(ContentLanguage, { minItems: 1, maxItems: 50, uniqueItems: true })),
	...LocalizationLanguageQuery,
	sort: t.Optional(ReviewSortSchema),
	cursor: t.Optional(t.String({ maxLength: 1024 })),
	limit: t.Optional(t.Integer({ minimum: 1, maximum: 50, default: 20 })),
} as const;

const ReviewScores = t.Array(t.Integer({ minimum: 1, maximum: 10 }), {
	minItems: 1,
	maxItems: 10,
	uniqueItems: true,
});
const OptionalReviewTitle = t.Optional(t.String({ minLength: 1, maxLength: 500 }));
const OptionalReviewSummary = t.Optional(t.String({ minLength: 1, maxLength: 2_000 }));
const NullableReviewTitle = t.Nullable(t.String({ minLength: 1, maxLength: 500 }));
const NullableReviewSummary = t.Nullable(t.String({ minLength: 1, maxLength: 2_000 }));

export const ListReviewsQuery = t.Object(
	{
		...ListReviewsCommonQuery,
		scoreRealmId: t.Optional(Uuid),
		scores: t.Optional(ReviewScores),
	},
	{ additionalProperties: false },
);
export type ListReviewsQuery = StaticDecode<typeof ListReviewsQuery>;

export type ReviewScoreFilterResolution =
	| Readonly<{ status: "absent" }>
	| Readonly<{
			status: "present";
			realmId: string;
			values: readonly number[];
	  }>
	| Readonly<{ status: "invalid" }>;

export function resolveReviewScoreFilter(
	query: Pick<ListReviewsQuery, "scoreRealmId" | "scores">,
): ReviewScoreFilterResolution {
	if (query.scoreRealmId && query.scores)
		return {
			status: "present",
			realmId: query.scoreRealmId,
			values: query.scores,
		};
	if (query.scoreRealmId || query.scores) return { status: "invalid" };
	return { status: "absent" };
}

export const CreateReviewBody = t.Object({
	targetId: Uuid,
	progressEntryId: t.Optional(Uuid),
	publishRealmIds: PostPublishRealmIds,
	score: t.Optional(
		t.Object(
			{
				realmId: Uuid,
				value: t.Integer({ minimum: 1, maximum: 10 }),
			},
			{ additionalProperties: false },
		),
	),
	language: ContentLanguage,
	title: OptionalReviewTitle,
	summary: OptionalReviewSummary,
	body: PortableTextDocument,
	revisionContext: t.Optional(RevisionContext),
});
export type CreateReviewBody = StaticDecode<typeof CreateReviewBody>;

export const ReviewParams = t.Object({ reviewId: Uuid });
export type ReviewParams = StaticDecode<typeof ReviewParams>;
export const GetReviewQuery = t.Object(
	{
		realmId: t.Optional(Uuid),
		...LocalizationLanguageQuery,
	},
	{ additionalProperties: false },
);
export type GetReviewQuery = StaticDecode<typeof GetReviewQuery>;

export const UpdateReviewBody = t.Object({
	language: ContentLanguage,
	title: NullableReviewTitle,
	summary: NullableReviewSummary,
	body: PortableTextDocument,
	revisionContext: t.Optional(RevisionContext),
});
export type UpdateReviewBody = StaticDecode<typeof UpdateReviewBody>;

export const ScoreTargetParams = t.Object({ targetId: Uuid });
export type ScoreTargetParams = StaticDecode<typeof ScoreTargetParams>;

export const SetScoreBody = t.Object({
	realmId: Uuid,
	score: t.Integer({ minimum: 1, maximum: 10 }),
	visibility: t.Optional(ResourceVisibility),
});
export type SetScoreBody = StaticDecode<typeof SetScoreBody>;

export const ScoreAggregateQuery = t.Object({ realmId: Uuid });
export type ScoreAggregateQuery = StaticDecode<typeof ScoreAggregateQuery>;

export const ListViewerScoresQuery = t.Object(LocalizationLanguageQuery, {
	additionalProperties: false,
});
export type ListViewerScoresQuery = StaticDecode<typeof ListViewerScoresQuery>;
