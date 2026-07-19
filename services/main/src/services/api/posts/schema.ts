import { type Static, t } from "elysia";
import { PortableTextDocument } from "@rezics/block";

import { LanguageTag, Uuid } from "../schema";

export const ListPostsQuery = t.Object({
	realmId: t.Optional(Uuid),
	subjectId: t.Optional(Uuid),
	limit: t.Optional(t.Integer({ minimum: 1, maximum: 50, default: 20 })),
});
export type ListPostsQuery = Static<typeof ListPostsQuery>;

export const CreatePostBody = t.Object({
	title: t.String({ minLength: 1, maxLength: 500 }),
	body: PortableTextDocument,
	language: LanguageTag,
	realmId: t.Optional(Uuid),
	subjectId: t.Optional(Uuid),
});
export type CreatePostBody = Static<typeof CreatePostBody>;

export const PostParams = t.Object({ postId: Uuid });
export type PostParams = Static<typeof PostParams>;

export const UpdatePostBody = t.Object({
	title: t.String({ minLength: 1, maxLength: 500 }),
	body: PortableTextDocument,
	baseRevisionId: Uuid,
	editSummary: t.Optional(t.String({ maxLength: 500 })),
	minor: t.Optional(t.Boolean()),
});
export type UpdatePostBody = Static<typeof UpdatePostBody>;

export const ListRepliesQuery = t.Object({
	parentPostId: t.Optional(Uuid),
	cursor: t.Optional(t.String({ maxLength: 512 })),
	limit: t.Optional(t.Integer({ minimum: 1, maximum: 50, default: 25 })),
});
export type ListRepliesQuery = Static<typeof ListRepliesQuery>;

export const CreateReplyBody = t.Object({
	parentPostId: t.Optional(Uuid),
	realmId: t.Optional(Uuid),
	language: LanguageTag,
	body: PortableTextDocument,
});
export type CreateReplyBody = Static<typeof CreateReplyBody>;

export const ReplyParams = t.Object({ postId: Uuid, replyPostId: Uuid });
export type ReplyParams = Static<typeof ReplyParams>;

export const RootPostParams = t.Object({ postId: Uuid });
export type RootPostParams = Static<typeof RootPostParams>;

export const UpdateReplyBody = t.Object({
	body: PortableTextDocument,
	baseRevisionId: Uuid,
	editSummary: t.Optional(t.String({ maxLength: 500 })),
	minor: t.Optional(t.Boolean()),
});
export type UpdateReplyBody = Static<typeof UpdateReplyBody>;
