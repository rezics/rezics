import { type Static, t } from "elysia";
import {
	FeedSortValues,
	type PostKind,
	type UnitKind,
} from "../../database/schema/contract-values";
import { Uuid } from "../schema";

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

export const FeedContentKindSchema = t.UnionEnum(FeedContentKindValues);

export const FeedQuery = t.Object({
	sort: t.Optional(FeedSortSchema),
	content: t.Optional(t.Array(FeedContentKindSchema, { minItems: 1, uniqueItems: true })),
	personalized: t.Optional(t.Boolean()),
	realmId: t.Optional(Uuid),
	subjectId: t.Optional(Uuid),
	cursor: t.Optional(t.String({ maxLength: 1024 })),
	limit: t.Optional(t.Integer({ minimum: 1, maximum: 50, default: 20 })),
});
export type FeedQuery = Static<typeof FeedQuery>;
export type FeedSort = Static<typeof FeedSortSchema>;
