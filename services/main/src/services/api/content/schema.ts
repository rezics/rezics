import { type Static, t } from "elysia";
import { PortableText } from "@rezics/portable-text";

import { LanguageTag, Uuid } from "../schema";

export const BookContentParams = t.Object({ unitId: Uuid });
export type BookContentParams = Static<typeof BookContentParams>;

export const CreateContentNodeBody = t.Object(
	{
		parentId: t.Optional(Uuid),
		title: t.String({ minLength: 1, maxLength: 500 }),
		language: LanguageTag,
		position: t.String({ minLength: 1, maxLength: 64 }),
		content: t.Optional(PortableText),
		status: t.Optional(t.Union([t.Literal("draft"), t.Literal("published")])),
	},
	{ additionalProperties: false },
);
export type CreateContentNodeBody = Static<typeof CreateContentNodeBody>;

export const ContentNodeParams = t.Object({ unitId: Uuid, nodeId: Uuid });
export type ContentNodeParams = Static<typeof ContentNodeParams>;

export const UpdateContentNodeBody = t.Object({
	parentId: t.Optional(t.Nullable(Uuid)),
	title: t.Optional(t.String({ minLength: 1, maxLength: 500 })),
	position: t.Optional(t.String({ minLength: 1, maxLength: 64 })),
});
export type UpdateContentNodeBody = Static<typeof UpdateContentNodeBody>;

export const ChapterParams = t.Object({ chapterId: Uuid });
export type ChapterParams = Static<typeof ChapterParams>;

export const ReadChapterQuery = t.Object({
	language: LanguageTag,
});
export type ReadChapterQuery = Static<typeof ReadChapterQuery>;

export const ChapterLocalizationParams = t.Object({
	chapterId: Uuid,
	language: LanguageTag,
});
export type ChapterLocalizationParams = Static<typeof ChapterLocalizationParams>;

export const UpsertChapterLocalizationBody = t.Object({
	title: t.String({ minLength: 1, maxLength: 500 }),
	content: PortableText,
	status: t.Union([t.Literal("draft"), t.Literal("published"), t.Literal("archived")]),
});
export type UpsertChapterLocalizationBody = Static<typeof UpsertChapterLocalizationBody>;
