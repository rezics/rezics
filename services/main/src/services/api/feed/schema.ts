import { type Static, t } from "elysia";
import { SimpleFeedContentKindValues, type UnitPredicate } from "@rezics/filter";
import { Type } from "@sinclair/typebox";
import {
	FeedSortValues,
	type PostKind,
	type UnitKind,
} from "../../database/schema/contract-values";
import { LocalizationLanguageQuery } from "../schema";

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

export const FeedRatedWorkUnitKindValues = [
	"book",
	"software",
	"media",
] as const satisfies readonly FeedUnitKind[];
export type FeedRatedWorkUnitKind = (typeof FeedRatedWorkUnitKindValues)[number];

export const FeedIdentityUnitKindValues = [
	"zone",
	"realm",
] as const satisfies readonly FeedUnitKind[];
export type FeedIdentityUnitKind = (typeof FeedIdentityUnitKindValues)[number];

export const FeedGeneralUnitKindValues = [
	"profile",
	"release",
	"entity",
	"tag",
	"series",
	"collection",
	"poll",
] as const satisfies readonly Exclude<FeedUnitKind, FeedRatedWorkUnitKind | FeedIdentityUnitKind>[];

export const FeedPostKindValues = [
	"post",
	"reply",
	"excerpt",
	"review",
	"chapter",
	"wiki",
	"picture",
] as const satisfies readonly PostKind[];
export type FeedPostKind = (typeof FeedPostKindValues)[number];

export const FeedNonReviewPostKindValues = [
	"post",
	"reply",
	"excerpt",
	"chapter",
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
	"post:wiki",
	"post:picture",
] as const;
export type FeedContentKind = (typeof FeedContentKindValues)[number];

export const DefaultFeedContentKindValues =
	SimpleFeedContentKindValues satisfies readonly FeedContentKind[];

export const FeedRequest = t.Object(
	{
		filter: t.Optional(Type.Unsafe<UnitPredicate>(Type.Ref("UnitPredicate"))),
		sort: t.Optional(FeedSortSchema),
		cursor: t.Optional(t.String({ maxLength: 1024 })),
		limit: t.Optional(t.Integer({ minimum: 1, maximum: 50, default: 20 })),
		...LocalizationLanguageQuery,
	},
	{ additionalProperties: false },
);
export type FeedRequest = Static<typeof FeedRequest>;
export type FeedSort = Static<typeof FeedSortSchema>;
