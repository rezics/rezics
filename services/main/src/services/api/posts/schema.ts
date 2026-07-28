import { type Static, t } from "elysia";
import { PortableTextDocument } from "@rezics/block";

import {
	DateTime,
	FractionalPosition,
	ContentLanguage,
	LocalizationLanguageQuery,
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
export type ListPostsQuery = Static<typeof ListPostsQuery>;

export const CreatePostBody = t.Object({
	title: t.String({ minLength: 1, maxLength: 500 }),
	body: PortableTextDocument,
	language: ContentLanguage,
	realmId: t.Optional(Uuid),
	subjectId: t.Optional(Uuid),
});
export type CreatePostBody = Static<typeof CreatePostBody>;

export const PostParams = t.Object({ postId: Uuid });
export type PostParams = Static<typeof PostParams>;
export const GetPostQuery = t.Object(
	{
		realmId: t.Optional(Uuid),
		...LocalizationLanguageQuery,
	},
	{ additionalProperties: false },
);
export type GetPostQuery = Static<typeof GetPostQuery>;

const PostScoreInput = t.Object({ scoreId: Uuid }, { additionalProperties: false });
/**
 * TODO: Allow multiple Scores after the frontend can clearly support selecting,
 * ordering, and managing every Score attached to a Post.
 */
export const ReplacePostScoresBody = t.Array(PostScoreInput, { maxItems: 1 });
export type ReplacePostScoresBody = Static<typeof ReplacePostScoresBody>;

export const PostScoreResponse = t.Object({
	scoreId: Uuid,
	profileId: Uuid,
	unitId: Uuid,
	contextUnitId: Uuid,
	value: t.Integer({ minimum: 1, maximum: 10 }),
	position: FractionalPosition,
	updatedAt: DateTime,
});
export const PostScoreListResponse = t.Object({ items: t.Array(PostScoreResponse) });

export const UpdatePostBody = t.Object({
	language: ContentLanguage,
	title: t.String({ minLength: 1, maxLength: 500 }),
	body: PortableTextDocument,
	baseRevisionId: Uuid,
	editSummary: t.Optional(t.String({ maxLength: 500 })),
	minor: t.Optional(t.Boolean()),
});
export type UpdatePostBody = Static<typeof UpdatePostBody>;

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
export type ListRepliesQuery = Static<typeof ListRepliesQuery>;

export const CreateReplyBody = t.Object({
	parentPostId: t.Optional(Uuid),
	realmId: t.Optional(Uuid),
	language: ContentLanguage,
	body: PortableTextDocument,
});
export type CreateReplyBody = Static<typeof CreateReplyBody>;

export const ReplyParams = t.Object({ postId: Uuid, replyPostId: Uuid });
export type ReplyParams = Static<typeof ReplyParams>;

export const RootPostParams = t.Object({ postId: Uuid });
export type RootPostParams = Static<typeof RootPostParams>;

export const UpdateReplyBody = t.Object({
	language: ContentLanguage,
	body: PortableTextDocument,
	baseRevisionId: Uuid,
	editSummary: t.Optional(t.String({ maxLength: 500 })),
	minor: t.Optional(t.Boolean()),
});
export type UpdateReplyBody = Static<typeof UpdateReplyBody>;
