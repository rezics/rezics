import { type Static, t } from "elysia";
import { PortableTextDocument } from "@rezics/content-structure";

import { LanguageTag, Uuid } from "../schema";

export const BookContentStructureParams = t.Object({ unitId: Uuid });
export type BookContentStructureParams = Static<typeof BookContentStructureParams>;

export const CreateContentStructureNodeBody = t.Object(
	{
		parentId: t.Optional(Uuid),
		title: t.String({ minLength: 1, maxLength: 500 }),
		language: LanguageTag,
		position: t.String({ minLength: 1, maxLength: 64 }),
		content: t.Optional(PortableTextDocument),
		status: t.Optional(t.Union([t.Literal("draft"), t.Literal("published")])),
	},
	{ additionalProperties: false },
);
export type CreateContentStructureNodeBody = Static<typeof CreateContentStructureNodeBody>;

export const ContentStructureNodeParams = t.Object({ unitId: Uuid, nodeId: Uuid });
export type ContentStructureNodeParams = Static<typeof ContentStructureNodeParams>;

export const UpdateContentStructureNodeBody = t.Object({
	parentId: t.Optional(t.Nullable(Uuid)),
	title: t.Optional(t.String({ minLength: 1, maxLength: 500 })),
	position: t.Optional(t.String({ minLength: 1, maxLength: 64 })),
});
export type UpdateContentStructureNodeBody = Static<typeof UpdateContentStructureNodeBody>;

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
	content: PortableTextDocument,
	status: t.Union([t.Literal("draft"), t.Literal("published"), t.Literal("archived")]),
});
export type UpsertChapterLocalizationBody = Static<typeof UpsertChapterLocalizationBody>;
