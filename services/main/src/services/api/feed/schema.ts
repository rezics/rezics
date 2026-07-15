import { type Static, t } from "elysia";
import { FeedSortValues } from "../../database/schema/contract-values";
import { Uuid } from "../schema";

export const FeedSortSchema = t.UnionEnum(FeedSortValues, { default: "best" });

export const FeedQuery = t.Object({
	sort: t.Optional(FeedSortSchema),
	personalized: t.Optional(t.Boolean()),
	realmId: t.Optional(Uuid),
	subjectId: t.Optional(Uuid),
	cursor: t.Optional(t.String({ maxLength: 1024 })),
	limit: t.Optional(t.Integer({ minimum: 1, maximum: 50, default: 20 })),
});
export type FeedQuery = Static<typeof FeedQuery>;
export type FeedSort = Static<typeof FeedSortSchema>;
