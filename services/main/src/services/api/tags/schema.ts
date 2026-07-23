import { type Static, t } from "elysia";

import { ContentLanguage, DateTime, FractionalPosition, Uuid } from "../schema";
import { CatalogUnitType } from "../units/schema";

const TagVoteValue = t.Nullable(t.Union([t.Literal(-1), t.Literal(1)]));
const BinaryVote = t.Union([t.Literal(-1), t.Literal(1)]);
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
		structureLimit: t.Optional(t.Integer({ minimum: 1, maximum: 50, default: 20 })),
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

export const TagStructureMemberResponse = t.Object({
	ordinal: t.Integer({ minimum: 0 }),
	tagId: Uuid,
	title: t.Nullable(t.String()),
	summary: t.Nullable(t.String()),
});

const UnitTagStructureResponse = t.Object({
	structureId: Uuid,
	pinned: t.Boolean(),
	position: t.Nullable(FractionalPosition),
	score: t.Integer(),
	voteCount: t.Integer({ minimum: 0 }),
	viewerVote: TagVoteValue,
	definitionScore: t.Integer(),
	definitionVoteCount: t.Integer({ minimum: 0 }),
	members: t.Array(TagStructureMemberResponse, { minItems: 2 }),
	createdAt: DateTime,
	updatedAt: DateTime,
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
	structures: t.Array(UnitTagStructureResponse),
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

export const TagIdParams = t.Object({ tagId: Uuid });
export type TagIdParams = Static<typeof TagIdParams>;

export const TagHierarchyQuery = t.Object(
	{
		language: t.Optional(ContentLanguage),
		childLimit: t.Optional(t.Integer({ minimum: 1, maximum: 100, default: 30 })),
		grandchildLimit: t.Optional(t.Integer({ minimum: 1, maximum: 50, default: 12 })),
	},
	{ additionalProperties: false },
);
export type TagHierarchyQuery = Static<typeof TagHierarchyQuery>;

const TagHierarchyNode = t.Object({
	tagId: Uuid,
	title: t.Nullable(t.String()),
	summary: t.Nullable(t.String()),
	score: t.Integer(),
	voteCount: t.Integer({ minimum: 0 }),
});

export const TagHierarchyResponse = t.Object({
	tagId: Uuid,
	title: t.Nullable(t.String()),
	summary: t.Nullable(t.String()),
	children: t.Array(
		t.Object({
			...TagHierarchyNode.properties,
			children: t.Array(TagHierarchyNode),
		}),
	),
});

export const CreateTagStructureBody = t.Object(
	{
		memberTagIds: t.Array(Uuid, {
			minItems: 2,
			maxItems: 16,
			uniqueItems: true,
		}),
	},
	{ additionalProperties: false },
);
export type CreateTagStructureBody = Static<typeof CreateTagStructureBody>;

export const UpdateTagStructureBody = t.Object(
	{
		memberTagIds: t.Array(Uuid, {
			minItems: 2,
			maxItems: 16,
			uniqueItems: true,
		}),
		updatedAt: DateTime,
		reason: t.String({ minLength: 1, maxLength: 500 }),
	},
	{ additionalProperties: false },
);
export type UpdateTagStructureBody = Static<typeof UpdateTagStructureBody>;

export const TagStructureParams = t.Object({ structureId: Uuid });
export type TagStructureParams = Static<typeof TagStructureParams>;

export const TagStructureQuery = t.Object(
	{ language: t.Optional(ContentLanguage) },
	{ additionalProperties: false },
);
export type TagStructureQuery = Static<typeof TagStructureQuery>;

export const TagStructureResponse = t.Object({
	id: Uuid,
	kind: t.Literal("tag.hierarchy_path"),
	definitionVersion: t.Literal(1),
	createdByProfileId: Uuid,
	score: t.Integer(),
	voteCount: t.Integer({ minimum: 0 }),
	viewerVote: TagVoteValue,
	members: t.Array(TagStructureMemberResponse, { minItems: 2 }),
	createdAt: DateTime,
	updatedAt: DateTime,
});

export const CreateTagStructureResponse = t.Object({
	structureId: Uuid,
	created: t.Boolean(),
});

export const VoteBody = t.Object({ value: BinaryVote }, { additionalProperties: false });
export type VoteBody = Static<typeof VoteBody>;

export const VoteSummaryResponse = t.Object({
	score: t.Integer(),
	voteCount: t.Integer({ minimum: 0 }),
	viewerVote: TagVoteValue,
});

export const UnitTagStructureParams = t.Object({
	type: CatalogUnitType,
	unitId: Uuid,
	structureId: Uuid,
});
export type UnitTagStructureParams = Static<typeof UnitTagStructureParams>;

export const TagStructureApplicationResponse = t.Object({
	unitId: Uuid,
	structureId: Uuid,
	...VoteSummaryResponse.properties,
});
