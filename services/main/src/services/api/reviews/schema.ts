import { type Static, t } from "elysia";
import { PortableText } from "@rezics/portable-text";

import { LanguageTag, Uuid } from "../schema";

export const ListReviewsQuery = t.Object({
	targetId: t.Optional(Uuid),
	realmId: t.Optional(Uuid),
	limit: t.Optional(t.Integer({ minimum: 1, maximum: 50, default: 20 })),
});
export type ListReviewsQuery = Static<typeof ListReviewsQuery>;

export const CreateReviewBody = t.Object({
	targetId: Uuid,
	realmId: t.Optional(Uuid),
	language: LanguageTag,
	title: t.String({ minLength: 1, maxLength: 500 }),
	summary: t.Optional(t.String({ maxLength: 2_000 })),
	body: PortableText,
	score: t.Optional(t.Integer({ minimum: 1, maximum: 10 })),
});
export type CreateReviewBody = Static<typeof CreateReviewBody>;

export const ReviewParams = t.Object({ reviewId: Uuid });
export type ReviewParams = Static<typeof ReviewParams>;

export const UpdateReviewBody = t.Object({
	language: LanguageTag,
	title: t.String({ minLength: 1, maxLength: 500 }),
	summary: t.Optional(t.String({ maxLength: 2_000 })),
	body: PortableText,
});
export type UpdateReviewBody = Static<typeof UpdateReviewBody>;

export const ScoreTargetParams = t.Object({ targetId: Uuid });
export type ScoreTargetParams = Static<typeof ScoreTargetParams>;

export const SetScoreBody = t.Object({
	realmId: Uuid,
	score: t.Integer({ minimum: 1, maximum: 10 }),
});
export type SetScoreBody = Static<typeof SetScoreBody>;

export const ScoreAggregateQuery = t.Object({ realmId: Uuid });
export type ScoreAggregateQuery = Static<typeof ScoreAggregateQuery>;
