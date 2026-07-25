import { type Static, t } from "elysia";
import { PortableTextDocument } from "@rezics/block";

import { ContentLanguage, Uuid } from "../schema";

export const ListReviewsQuery = t.Object({
	targetId: t.Optional(Uuid),
	realmId: t.Optional(Uuid),
	languages: t.Optional(
		t.Array(ContentLanguage, { minItems: 1, maxItems: 50, uniqueItems: true }),
	),
	search: t.Optional(t.String({ minLength: 1, maxLength: 200 })),
	scoreContextUnitId: t.Optional(Uuid),
	scores: t.Optional(
		t.Array(t.Integer({ minimum: 1, maximum: 10 }), {
			minItems: 1,
			maxItems: 10,
			uniqueItems: true,
		}),
	),
	limit: t.Optional(t.Integer({ minimum: 1, maximum: 50, default: 20 })),
});
export type ListReviewsQuery = Static<typeof ListReviewsQuery>;

export const CreateReviewBody = t.Object({
	targetId: Uuid,
	realmId: t.Optional(Uuid),
	score: t.Optional(
		t.Object(
			{
				contextUnitId: Uuid,
				value: t.Integer({ minimum: 1, maximum: 10 }),
			},
			{ additionalProperties: false },
		),
	),
	language: ContentLanguage,
	title: t.String({ minLength: 1, maxLength: 500 }),
	summary: t.Optional(t.String({ maxLength: 2_000 })),
	body: PortableTextDocument,
});
export type CreateReviewBody = Static<typeof CreateReviewBody>;

export const ReviewParams = t.Object({ reviewId: Uuid });
export type ReviewParams = Static<typeof ReviewParams>;
export const GetReviewQuery = t.Object({ realmId: t.Optional(Uuid) });
export type GetReviewQuery = Static<typeof GetReviewQuery>;

export const UpdateReviewBody = t.Object({
	language: ContentLanguage,
	title: t.String({ minLength: 1, maxLength: 500 }),
	summary: t.Optional(t.String({ maxLength: 2_000 })),
	body: PortableTextDocument,
});
export type UpdateReviewBody = Static<typeof UpdateReviewBody>;

export const ScoreTargetParams = t.Object({ targetId: Uuid });
export type ScoreTargetParams = Static<typeof ScoreTargetParams>;

export const SetScoreBody = t.Object({
	contextUnitId: Uuid,
	score: t.Integer({ minimum: 1, maximum: 10 }),
});
export type SetScoreBody = Static<typeof SetScoreBody>;

export const ScoreAggregateQuery = t.Object({ contextUnitId: Uuid });
export type ScoreAggregateQuery = Static<typeof ScoreAggregateQuery>;

export const ListViewerScoresQuery = t.Object({
	language: t.Optional(ContentLanguage),
});
export type ListViewerScoresQuery = Static<typeof ListViewerScoresQuery>;
