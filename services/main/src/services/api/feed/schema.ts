import type { UnitOwner } from "@rezics/reference";
import { SimpleFeedContentKindValues, UnitFilter } from "@rezics/filter";
import { t } from "elysia";
import type { StaticDecode } from "typebox";
import {
	FeedSortValues,
	type PostKind,
} from "@rezics/schema/postgres/shared/contract-values";
import { LocalizationLanguageQuery } from "../schema";

export const FeedSortSchema = t.UnionEnum(FeedSortValues, { default: "best" });

export const MaximumFeedAttributionsPerItem = 8;
export const MaximumFeedRealmContextsPerItem = 8;
export const MaximumFeedPageSize = 50;

export const FeedUnitOwnerValues = [
 "publishing", "music", "program", "software", "grouping", "entity", "reference",
 "distribution", "video", "audio", "tag", "zone", "collection", "poll", "realm",
] as const satisfies readonly UnitOwner[];
export type FeedUnitOwner = (typeof FeedUnitOwnerValues)[number];
export const FeedRatedWorkOwnerValues = ["publishing", "music", "program", "software", "grouping"] as const;
export const FeedPostKindValues = ["post", "reply", "excerpt", "review", "chapter", "wiki", "picture"] as const satisfies readonly PostKind[];
export type FeedPostKind = (typeof FeedPostKindValues)[number];
export const FeedNonReviewPostKindValues = ["post", "reply", "excerpt", "chapter", "picture"] as const;
export const FeedContentKindValues = [...SimpleFeedContentKindValues, "post:reply"] as const;
export type FeedContentKind = (typeof FeedContentKindValues)[number];
export const DefaultFeedContentKindValues = SimpleFeedContentKindValues;

export const FeedRequest = t.Object(
	{
		filter: t.Optional(UnitFilter),
		sort: t.Optional(FeedSortSchema),
		cursor: t.Optional(t.String({ maxLength: 1024 })),
		limit: t.Optional(t.Integer({ minimum: 1, maximum: MaximumFeedPageSize, default: 20 })),
		...LocalizationLanguageQuery,
	},
	{ additionalProperties: false },
);
export type FeedRequest = StaticDecode<typeof FeedRequest>;
export type FeedSort = StaticDecode<typeof FeedSortSchema>;
