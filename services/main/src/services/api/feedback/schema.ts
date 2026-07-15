import { type Static, t } from "elysia";

import { FeedbackKindValues } from "../../database/schema/contract-values";
import { DateTime, Uuid } from "../schema";

const FeedbackType = t.Union(FeedbackKindValues.map((value) => t.Literal(value)));

export const CreateFeedbackBody = t.Object(
	{
		type: FeedbackType,
		content: t.String({ minLength: 1, maxLength: 10_000 }),
		url: t.Optional(t.String({ format: "uri", maxLength: 2_000 })),
		subjectUnitId: t.Optional(Uuid),
		realmId: t.Optional(Uuid),
	},
	{ additionalProperties: false },
);
export type CreateFeedbackBody = Static<typeof CreateFeedbackBody>;

export const ListFeedbackQuery = t.Object({
	limit: t.Optional(t.Integer({ minimum: 1, maximum: 100, default: 30 })),
});
export type ListFeedbackQuery = Static<typeof ListFeedbackQuery>;

export const FeedbackResponse = t.Object({
	id: Uuid,
	type: t.String(),
	content: t.String(),
	url: t.Nullable(t.String()),
	subjectUnitId: t.Nullable(Uuid),
	status: t.String(),
	resolution: t.Nullable(t.String()),
	createdAt: DateTime,
	updatedAt: DateTime,
});

export const FeedbackListResponse = t.Object({ items: t.Array(FeedbackResponse) });
