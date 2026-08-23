import { type Static, t } from "elysia";

import {
	UnitStructureMaximumMembers,
	UnitStructureMinimumMembers,
} from "../../database/schema";
import {
	ContentLanguage,
	LocalizationLanguageQuery,
	DateTime,
	DateTimeString,
	FractionalPosition,
	FractionalPositionInput,
	RevisionContext,
	Uuid,
} from "../schema";
import { AvatarResponse } from "../schema/response";
import { TaggableUnitType } from "../unit-resources/schema";
import { WorkUnitType } from "../units/schema";

const TagVoteValue = t.Nullable(t.Union([t.Literal(-1), t.Literal(1)]));
const BinaryVote = t.Union([t.Literal(-1), t.Literal(1)]);
const LocalizedTagSummary = {
	tagId: Uuid,
	language: t.Nullable(ContentLanguage),
	title: t.Nullable(t.String()),
	summary: t.Nullable(t.String()),
	avatar: AvatarResponse,
	createdAt: DateTimeString,
	updatedAt: DateTimeString,
} as const;

export const UnitTagLandscapeParams = t.Object({
	type: TaggableUnitType,
	unitId: Uuid,
});
export type UnitTagLandscapeParams = Static<typeof UnitTagLandscapeParams>;

export const UnitTagLandscapeQuery = t.Object(
	{
		...LocalizationLanguageQuery,
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
	language: t.Nullable(ContentLanguage),
	title: t.Nullable(t.String()),
	summary: t.Nullable(t.String()),
	avatar: AvatarResponse,
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
	members: t.Array(TagStructureMemberResponse, {
		minItems: UnitStructureMinimumMembers,
		maxItems: UnitStructureMaximumMembers,
	}),
	createdAt: DateTime,
	updatedAt: DateTime,
});

export const RealmVotedTagResponse = t.Object({
	...LocalizedTagSummary,
	realmId: Uuid,
	contextPostId: Uuid,
	score: t.Integer(),
	voteCount: t.Integer({ minimum: 0 }),
	viewerVote: TagVoteValue,
});

export const RealmTagVoteContextResponse = t.Object({
	realmId: Uuid,
	language: t.Nullable(ContentLanguage),
	title: t.Nullable(t.String()),
	summary: t.Nullable(t.String()),
	avatar: AvatarResponse,
});

export const RealmTagSubscriptionResponse = t.Object({
	realmId: Uuid,
	language: t.Nullable(ContentLanguage),
	title: t.Nullable(t.String()),
	summary: t.Nullable(t.String()),
	avatar: AvatarResponse,
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
			canVote: t.Boolean(),
			votedTags: t.Array(RealmVotedTagResponse, { minItems: 1 }),
		}),
	),
	voteRealms: t.Array(RealmTagVoteContextResponse),
});

export const RealmUnitTagVoteListResponse = t.Object({
	realmId: Uuid,
	tags: t.Array(RealmVotedTagResponse),
});

export const RealmUnitTagVoteListQuery = t.Object(
	{
		...LocalizationLanguageQuery,
		limit: t.Optional(t.Integer({ minimum: 1, maximum: 50, default: 50 })),
	},
	{ additionalProperties: false },
);
export type RealmUnitTagVoteListQuery = Static<typeof RealmUnitTagVoteListQuery>;

export const RealmTagSubscriptionListQuery = t.Object(LocalizationLanguageQuery, {
	additionalProperties: false,
});
export type RealmTagSubscriptionListQuery = Static<typeof RealmTagSubscriptionListQuery>;

export const RealmTagSubscriptionListResponse = t.Object({
	items: t.Array(RealmTagSubscriptionResponse),
});

export const RealmTagSubscriptionParams = t.Object({ realmId: Uuid });
export type RealmTagSubscriptionParams = Static<typeof RealmTagSubscriptionParams>;

export const UpsertRealmTagSubscriptionBody = t.Object(
	{ position: t.Optional(FractionalPositionInput) },
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
		...LocalizationLanguageQuery,
		childLimit: t.Optional(t.Integer({ minimum: 1, maximum: 100, default: 30 })),
		grandchildLimit: t.Optional(t.Integer({ minimum: 1, maximum: 50, default: 12 })),
	},
	{ additionalProperties: false },
);
export type TagHierarchyQuery = Static<typeof TagHierarchyQuery>;

const TagHierarchyNode = t.Object({
	tagId: Uuid,
	language: t.Nullable(ContentLanguage),
	title: t.Nullable(t.String()),
	summary: t.Nullable(t.String()),
	score: t.Integer(),
	voteCount: t.Integer({ minimum: 0 }),
});

export const TagHierarchyResponse = t.Object({
	tagId: Uuid,
	language: t.Nullable(ContentLanguage),
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
			minItems: UnitStructureMinimumMembers,
			maxItems: UnitStructureMaximumMembers,
			uniqueItems: true,
		}),
		revisionContext: t.Optional(RevisionContext),
	},
	{ additionalProperties: false },
);
export type CreateTagStructureBody = Static<typeof CreateTagStructureBody>;

export const TagStructureParams = t.Object({ structureId: Uuid });
export type TagStructureParams = Static<typeof TagStructureParams>;

export const TagStructureQuery = t.Object(LocalizationLanguageQuery, {
	additionalProperties: false,
});
export type TagStructureQuery = Static<typeof TagStructureQuery>;

export const TagStructureResponse = t.Object({
	id: Uuid,
	kind: t.Literal("tag.hierarchy_path"),
	definitionVersion: t.Literal(1),
	createdByProfileId: Uuid,
	score: t.Integer(),
	voteCount: t.Integer({ minimum: 0 }),
	viewerVote: TagVoteValue,
	members: t.Array(TagStructureMemberResponse, {
		minItems: UnitStructureMinimumMembers,
		maxItems: UnitStructureMaximumMembers,
	}),
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
	type: WorkUnitType,
	unitId: Uuid,
	structureId: Uuid,
});
export type UnitTagStructureParams = Static<typeof UnitTagStructureParams>;

export const TagStructureApplicationResponse = t.Object({
	unitId: Uuid,
	structureId: Uuid,
	...VoteSummaryResponse.properties,
});
