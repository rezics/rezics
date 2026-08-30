import type { StaticDecode } from "typebox";
import { t } from "elysia";
import { PortableTextDocument } from "@rezics/block";

import {
	DateTime,
	FractionalPosition,
	ContentLanguage,
	LocalizationLanguageQuery,
	RevisionContext,
	ResourceVisibility,
	Uuid,
} from "../schema";

export const ListPostsQuery = t.Object(
	{
		realmId: t.Optional(Uuid),
		subjectId: t.Optional(Uuid),
		...LocalizationLanguageQuery,
		limit: t.Optional(t.Integer({ minimum: 1, maximum: 50, default: 20 })),
	},
	{ additionalProperties: false },
);
export type ListPostsQuery = StaticDecode<typeof ListPostsQuery>;

const OptionalPostTitle = t.Optional(t.String({ minLength: 1, maxLength: 500 }));
const OptionalPostSummary = t.Optional(t.String({ minLength: 1, maxLength: 2_000 }));
const NullablePostTitle = t.Nullable(t.String({ minLength: 1, maxLength: 500 }));
const NullablePostSummary = t.Nullable(t.String({ minLength: 1, maxLength: 2_000 }));
const ContentSpoilerLevel = t.Union([t.Literal(0), t.Literal(1), t.Literal(2)]);

export const MaximumPostPublishRealmCount = 10;
export const PostPublishRealmIds = t.Array(Uuid, {
	maxItems: MaximumPostPublishRealmCount,
	uniqueItems: true,
});

const CreatePostFields = {
	title: OptionalPostTitle,
	summary: OptionalPostSummary,
	body: PortableTextDocument,
	language: ContentLanguage,
	publishRealmIds: PostPublishRealmIds,
	contentSpoilerLevel: t.Optional(ContentSpoilerLevel),
	contentNsfw: t.Optional(t.Boolean()),
} as const;

export const CreatePostBody = t.Union([
	t.Object(
		{
			...CreatePostFields,
			postKind: t.Literal("post"),
			subjectId: t.Optional(Uuid),
			revisionContext: t.Optional(RevisionContext),
		},
		{ additionalProperties: false },
	),
	t.Object(
		{
			...CreatePostFields,
			postKind: t.Literal("excerpt"),
			subjectId: Uuid,
			revisionContext: t.Optional(RevisionContext),
		},
		{ additionalProperties: false },
	),
]);
export type CreatePostBody = StaticDecode<typeof CreatePostBody>;

export const CreateWikiBody = t.Object(
	{
		accessMode: t.Union([t.Literal("community_owned"), t.Literal("restricted")]),
		title: t.String({ minLength: 1, maxLength: 500 }),
		body: PortableTextDocument,
		language: ContentLanguage,
		publishRealmIds: PostPublishRealmIds,
		subjectId: t.Optional(Uuid),
		revisionContext: t.Optional(RevisionContext),
	},
	{ additionalProperties: false },
);
export type CreateWikiBody = StaticDecode<typeof CreateWikiBody>;

export const PostParams = t.Object({ postId: Uuid });
export type PostParams = StaticDecode<typeof PostParams>;
export const GetPostQuery = t.Object(
	{
		realmId: t.Optional(Uuid),
		...LocalizationLanguageQuery,
	},
	{ additionalProperties: false },
);
export type GetPostQuery = StaticDecode<typeof GetPostQuery>;

const PostScoreInput = t.Object({ scoreId: Uuid }, { additionalProperties: false });
export const MaximumPostScoreCount = 5;
export const ReplacePostScoresBody = t.Array(PostScoreInput, {
	maxItems: MaximumPostScoreCount,
});
export type ReplacePostScoresBody = StaticDecode<typeof ReplacePostScoresBody>;

export const PostScoreResponse = t.Object({
	scoreId: Uuid,
	profileId: Uuid,
	unitId: Uuid,
	realmId: Uuid,
	realmTitle: t.Nullable(t.String()),
	value: t.Integer({ minimum: 1, maximum: 10 }),
	visibility: ResourceVisibility,
	position: FractionalPosition,
	updatedAt: DateTime,
});
export const PostScoreListResponse = t.Object({ items: t.Array(PostScoreResponse) });

export const UpdatePostBody = t.Object({
	language: ContentLanguage,
	title: NullablePostTitle,
	summary: NullablePostSummary,
	body: PortableTextDocument,
	baseRevisionId: Uuid,
	editSummary: t.Optional(t.String({ maxLength: 500 })),
	minor: t.Optional(t.Boolean()),
	contentSpoilerLevel: t.Optional(ContentSpoilerLevel),
	contentNsfw: t.Optional(t.Boolean()),
	revisionContext: t.Optional(RevisionContext),
});
export type UpdatePostBody = StaticDecode<typeof UpdatePostBody>;

export const ListRepliesQuery = t.Object(
	{
		realmId: t.Optional(Uuid),
		parentPostId: t.Optional(Uuid),
		...LocalizationLanguageQuery,
		cursor: t.Optional(t.String({ maxLength: 512 })),
		limit: t.Optional(t.Integer({ minimum: 1, maximum: 50, default: 25 })),
	},
	{ additionalProperties: false },
);
export type ListRepliesQuery = StaticDecode<typeof ListRepliesQuery>;

export const CreateReplyBody = t.Object({
	parentPostId: t.Optional(Uuid),
	realmId: t.Optional(Uuid),
	language: ContentLanguage,
	body: PortableTextDocument,
	revisionContext: t.Optional(RevisionContext),
});
export type CreateReplyBody = StaticDecode<typeof CreateReplyBody>;

export const ReplyParams = t.Object({ postId: Uuid, replyPostId: Uuid });
export type ReplyParams = StaticDecode<typeof ReplyParams>;

export const RootPostParams = t.Object({ postId: Uuid });
export type RootPostParams = StaticDecode<typeof RootPostParams>;

export const UpdateReplyBody = t.Object({
	language: ContentLanguage,
	body: PortableTextDocument,
	baseRevisionId: Uuid,
	editSummary: t.Optional(t.String({ maxLength: 500 })),
	minor: t.Optional(t.Boolean()),
	revisionContext: t.Optional(RevisionContext),
});
export type UpdateReplyBody = StaticDecode<typeof UpdateReplyBody>;
