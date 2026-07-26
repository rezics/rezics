import { type Static, t } from "elysia";
import { PortableTextDocument } from "@rezics/block";

import { FractionalPosition, ContentLanguage, Uuid } from "../schema";
import { ContentRatingValues } from "../../database/schema/contract-values";

export const UnitContentStructuresParams = t.Object({ unitId: Uuid });
export const ContentStructureParams = t.Object({ unitId: Uuid, structureId: Uuid });
export const ContentStructureRevisionParams = t.Object({
	unitId: Uuid,
	structureId: Uuid,
	revisionId: Uuid,
});
export const ContentStructureRevisionListQuery = t.Object({
	limit: t.Optional(t.Integer({ minimum: 1, maximum: 100, default: 50 })),
});
export const GenericContentStructureNodeParams = t.Object({
	unitId: Uuid,
	structureId: Uuid,
	nodeId: Uuid,
});

export const ContentStructureTarget = t.Union([
	t.Object({ kind: t.Literal("content") }, { additionalProperties: false }),
	t.Object({ kind: t.Literal("none") }, { additionalProperties: false }),
	t.Object({ kind: t.Literal("unit"), unitId: Uuid }, { additionalProperties: false }),
	t.Object(
		{
			kind: t.Literal("external"),
			url: t.String({ minLength: 1, maxLength: 2_000, pattern: "^https://" }),
		},
		{ additionalProperties: false },
	),
]);

export const CreateContentStructureBody = t.Object(
	{
		kind: t.Union([
			t.Literal("book.contents"),
			t.Literal("post.contents"),
			t.Literal("realm.taxonomy"),
		]),
	},
	{ additionalProperties: false },
);

const ExistingContentUnit = t.Object(
	{ kind: t.Literal("unit"), unitId: Uuid },
	{ additionalProperties: false },
);
const InlineLabelContent = t.Object(
	{
		kind: t.Literal("label"),
		language: ContentLanguage,
		title: t.String({ minLength: 1, maxLength: 500 }),
	},
	{ additionalProperties: false },
);

export const CreateGenericContentStructureNodeBody = t.Object(
	{
		baseRevisionId: Uuid,
		parentId: t.Optional(Uuid),
		content: t.Union([ExistingContentUnit, InlineLabelContent]),
		documentKey: t.Optional(t.String({ pattern: "^[0-9a-f]{12}$" })),
		target: t.Optional(ContentStructureTarget),
		position: t.Optional(FractionalPosition),
		contentRating: t.Optional(t.UnionEnum(ContentRatingValues)),
	},
	{ additionalProperties: false },
);

export const UpdateGenericContentStructureNodeBody = t.Object(
	{
		baseRevisionId: Uuid,
		parentId: t.Optional(t.Nullable(Uuid)),
		contentUnitId: t.Optional(Uuid),
		documentKey: t.Optional(t.Nullable(t.String({ pattern: "^[0-9a-f]{12}$" }))),
		target: t.Optional(ContentStructureTarget),
		position: t.Optional(FractionalPosition),
		contentRating: t.Optional(t.Nullable(t.UnionEnum(ContentRatingValues))),
	},
	{ additionalProperties: false, minProperties: 2 },
);

export const ContentStructureRevisionBody = t.Object(
	{ baseRevisionId: Uuid },
	{ additionalProperties: false },
);
export const RestoreContentStructureRevisionBody = t.Object(
	{
		baseRevisionId: Uuid,
		message: t.Optional(t.String({ maxLength: 500 })),
		minor: t.Optional(t.Boolean()),
	},
	{ additionalProperties: false },
);

export const BookContentStructureParams = t.Object({ unitId: Uuid });
export type BookContentStructureParams = Static<typeof BookContentStructureParams>;

const BookContentStructureDraftNodeBase = {
	id: Uuid,
	parentId: t.Nullable(Uuid),
	order: t.Integer({ minimum: 0 }),
	title: t.String({ minLength: 1, maxLength: 500 }),
};

const ExistingBookContentStructureDraftNode = t.Object(
	{
		state: t.Literal("existing"),
		...BookContentStructureDraftNodeBase,
	},
	{ additionalProperties: false },
);

const NewBookContentStructureGroupDraftNode = t.Object(
	{
		state: t.Literal("new"),
		...BookContentStructureDraftNodeBase,
		language: ContentLanguage,
		contentKind: t.Literal("chapter_group"),
	},
	{ additionalProperties: false },
);

const NewBookContentStructureChapterDraftNode = t.Object(
	{
		state: t.Literal("new"),
		...BookContentStructureDraftNodeBase,
		language: ContentLanguage,
		contentKind: t.Literal("chapter"),
		content: PortableTextDocument,
		status: t.Union([t.Literal("draft"), t.Literal("published")]),
	},
	{ additionalProperties: false },
);

export const SaveBookContentStructureDraftBody = t.Object(
	{
		baseRevisionId: Uuid,
		nodes: t.Array(
			t.Union([
				ExistingBookContentStructureDraftNode,
				NewBookContentStructureGroupDraftNode,
				NewBookContentStructureChapterDraftNode,
			]),
			{ maxItems: 10_000 },
		),
	},
	{ additionalProperties: false },
);
export type SaveBookContentStructureDraftBody = Static<typeof SaveBookContentStructureDraftBody>;

export const ChapterParams = t.Object({ chapterId: Uuid });
export type ChapterParams = Static<typeof ChapterParams>;

export const ReadChapterQuery = t.Object({
	language: ContentLanguage,
});
export type ReadChapterQuery = Static<typeof ReadChapterQuery>;

export const ChapterLocalizationParams = t.Object({
	chapterId: Uuid,
	language: ContentLanguage,
});
export type ChapterLocalizationParams = Static<typeof ChapterLocalizationParams>;

export const UpsertChapterLocalizationBody = t.Object({
	title: t.String({ minLength: 1, maxLength: 500 }),
	content: PortableTextDocument,
	status: t.Union([t.Literal("draft"), t.Literal("published"), t.Literal("archived")]),
});
export type UpsertChapterLocalizationBody = Static<typeof UpsertChapterLocalizationBody>;
