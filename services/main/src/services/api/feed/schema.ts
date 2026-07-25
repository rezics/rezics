import { type Static, t } from "elysia";
import {
	FeedSortValues,
	type PostKind,
	type UnitKind,
} from "../../database/schema/contract-values";
import { ContentLanguage, Uuid } from "../schema";

export const FeedSortSchema = t.UnionEnum(FeedSortValues, { default: "best" });

export const FeedUnitKindValues = [
	"profile",
	"book",
	"software",
	"media",
	"release",
	"entity",
	"tag",
	"series",
	"zone",
	"collection",
	"poll",
	"realm",
] as const satisfies readonly UnitKind[];
export type FeedUnitKind = (typeof FeedUnitKindValues)[number];

export const FeedPostKindValues = [
	"post",
	"reply",
	"excerpt",
	"review",
	"chapter",
	"chapter_group",
	"wiki",
	"picture",
] as const satisfies readonly PostKind[];
export type FeedPostKind = (typeof FeedPostKindValues)[number];

export const FeedNonReviewPostKindValues = [
	"post",
	"reply",
	"excerpt",
	"chapter",
	"chapter_group",
	"wiki",
	"picture",
] as const satisfies readonly Exclude<FeedPostKind, "review">[];

export const FeedContentKindValues = [
	"unit:profile",
	"unit:book",
	"unit:software",
	"unit:media",
	"unit:release",
	"unit:entity",
	"unit:tag",
	"unit:series",
	"unit:zone",
	"unit:collection",
	"unit:poll",
	"unit:realm",
	"post:post",
	"post:reply",
	"post:excerpt",
	"post:review",
	"post:chapter",
	"post:chapter_group",
	"post:wiki",
	"post:picture",
] as const;
export type FeedContentKind = (typeof FeedContentKindValues)[number];

export const DefaultFeedContentKindValues = FeedContentKindValues.filter(
	(kind): kind is Exclude<FeedContentKind, "post:reply"> => kind !== "post:reply",
);

export const FeedQuery = t.Object(
	{
		languages: t.Optional(
			t.Array(ContentLanguage, { minItems: 1, maxItems: 50, uniqueItems: true }),
		),
		realmIds: t.Optional(t.Array(Uuid, { minItems: 1, maxItems: 50, uniqueItems: true })),
		sort: t.Optional(FeedSortSchema),
		cursor: t.Optional(t.String({ maxLength: 1024 })),
		limit: t.Optional(t.Integer({ minimum: 1, maximum: 50, default: 20 })),
	},
	{ additionalProperties: false },
);
export type FeedQuery = Static<typeof FeedQuery>;
export type FeedSort = Static<typeof FeedSortSchema>;
