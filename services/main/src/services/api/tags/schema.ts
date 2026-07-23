import { type Static, t } from "elysia";

import { ContentLanguage, DateTime, FractionalPosition, Uuid } from "../schema";
import { CatalogUnitType } from "../units/schema";

const TagVoteValue = t.Nullable(t.Union([t.Literal(-1), t.Literal(1)]));
const LocalizedTagSummary = {
	tagId: Uuid,
	title: t.Nullable(t.String()),
	summary: t.Nullable(t.String()),
	createdAt: DateTime,
	updatedAt: DateTime,
} as const;

export const UnitTagLandscapeParams = t.Object({
	type: CatalogUnitType,
	unitId: Uuid,
});
export type UnitTagLandscapeParams = Static<typeof UnitTagLandscapeParams>;

export const UnitTagLandscapeQuery = t.Object(
	{
		language: t.Optional(ContentLanguage),
		globalLimit: t.Optional(t.Integer({ minimum: 1, maximum: 100, default: 50 })),
		sourceLimit: t.Optional(t.Integer({ minimum: 1, maximum: 30, default: 10 })),
		perRealmLimit: t.Optional(t.Integer({ minimum: 1, maximum: 50, default: 12 })),
	},
	{ additionalProperties: false },
);
export type UnitTagLandscapeQuery = Static<typeof UnitTagLandscapeQuery>;

const GlobalUnitTagResponse = t.Object({
	...LocalizedTagSummary,
	pinned: t.Boolean(),
	position: t.Nullable(FractionalPosition),
	score: t.Integer(),
	voteCount: t.Integer({ minimum: 0 }),
	viewerVote: TagVoteValue,
});

const RealmVotedTagResponse = t.Object({
	...LocalizedTagSummary,
	realmId: Uuid,
	contextPostId: Uuid,
	score: t.Integer(),
	voteCount: t.Integer({ minimum: 0 }),
	viewerVote: TagVoteValue,
});

const RealmPolicyTagResponse = t.Object({
	...LocalizedTagSummary,
	realmId: Uuid,
	position: FractionalPosition,
});

export const RealmTagSubscriptionResponse = t.Object({
	realmId: Uuid,
	title: t.Nullable(t.String()),
	summary: t.Nullable(t.String()),
	canVote: t.Boolean(),
	position: FractionalPosition,
	createdAt: DateTime,
	updatedAt: DateTime,
});

export const UnitTagLandscapeResponse = t.Object({
	global: t.Array(GlobalUnitTagResponse),
	realms: t.Array(
		t.Object({
			...RealmTagSubscriptionResponse.properties,
			votedTags: t.Array(RealmVotedTagResponse),
			policyTags: t.Array(RealmPolicyTagResponse),
		}),
	),
});

export const RealmTagSubscriptionListQuery = t.Object(
	{ language: t.Optional(ContentLanguage) },
	{ additionalProperties: false },
);
export type RealmTagSubscriptionListQuery = Static<typeof RealmTagSubscriptionListQuery>;

export const RealmTagSubscriptionListResponse = t.Object({
	items: t.Array(RealmTagSubscriptionResponse),
});

export const RealmTagSubscriptionParams = t.Object({ realmId: Uuid });
export type RealmTagSubscriptionParams = Static<typeof RealmTagSubscriptionParams>;

export const UpsertRealmTagSubscriptionBody = t.Object(
	{ position: t.Optional(FractionalPosition) },
	{ additionalProperties: false },
);
export type UpsertRealmTagSubscriptionBody = Static<typeof UpsertRealmTagSubscriptionBody>;

export const RealmTagSubscriptionStateResponse = t.Object({
	realmId: Uuid,
	subscribed: t.Boolean(),
});
