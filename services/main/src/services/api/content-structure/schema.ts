import type { StaticDecode } from "typebox";
import { t } from "elysia";
import { PortableTextDocument } from "@rezics/block";

import {
	ContentLanguage,
	FractionalPositionInput,
	LocalizationLanguageQuery,
	RevisionContext,
	Uuid,
} from "../schema";
import {
	ContentRatingValues,
	RealmTagQueryStrategyValues,
	UnitOwnershipModeValues,
} from "../../database/schema/contract-values";
import { RevisionedBatchCommandLimit } from "../../history/revisioned-batch";

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
			t.Literal("media.contents"),
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
		position: t.Optional(FractionalPositionInput),
		contentRating: t.Optional(t.UnionEnum(ContentRatingValues)),
		realmTagQueryStrategy: t.Optional(t.UnionEnum(RealmTagQueryStrategyValues)),
		revisionContext: t.Optional(RevisionContext),
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
		position: t.Optional(FractionalPositionInput),
		contentRating: t.Optional(t.Nullable(t.UnionEnum(ContentRatingValues))),
		realmTagQueryStrategy: t.Optional(t.UnionEnum(RealmTagQueryStrategyValues)),
	},
	{ additionalProperties: false, minProperties: 2 },
);

const ContentStructureBatchOperationId = t.String({ minLength: 1, maxLength: 100 });
const ContentStructureBatchPlacement = t.Union([
	t.Object({ kind: t.UnionEnum(["start", "end"]) }, { additionalProperties: false }),
	t.Object(
		{ kind: t.UnionEnum(["before", "after"]), nodeId: Uuid },
		{ additionalProperties: false },
	),
]);
const CreateContentStructureNodeCommand = t.Object(
	{
		opId: ContentStructureBatchOperationId,
		type: t.Literal("node.create"),
		nodeId: Uuid,
		parentId: t.Nullable(Uuid),
		contentUnitId: Uuid,
		documentKey: t.Optional(t.Nullable(t.String({ pattern: "^[0-9a-f]{12}$" }))),
		target: t.Optional(ContentStructureTarget),
		placement: t.Optional(ContentStructureBatchPlacement),
		contentRating: t.Optional(t.Nullable(t.UnionEnum(ContentRatingValues))),
		realmTagQueryStrategy: t.Optional(t.Nullable(t.UnionEnum(RealmTagQueryStrategyValues))),
	},
	{ additionalProperties: false },
);
const UpdateContentStructureNodeCommand = t.Object(
	{
		opId: ContentStructureBatchOperationId,
		type: t.Literal("node.update"),
		nodeId: Uuid,
		contentUnitId: t.Optional(Uuid),
		documentKey: t.Optional(t.Nullable(t.String({ pattern: "^[0-9a-f]{12}$" }))),
		target: t.Optional(ContentStructureTarget),
		contentRating: t.Optional(t.Nullable(t.UnionEnum(ContentRatingValues))),
		realmTagQueryStrategy: t.Optional(t.Nullable(t.UnionEnum(RealmTagQueryStrategyValues))),
	},
	{ additionalProperties: false },
);
const MoveContentStructureNodeCommand = t.Object(
	{
		opId: ContentStructureBatchOperationId,
		type: t.Literal("node.move"),
		nodeId: Uuid,
		parentId: t.Optional(t.Nullable(Uuid)),
		placement: t.Optional(ContentStructureBatchPlacement),
	},
	{ additionalProperties: false },
);
const SwapContentStructureNodesCommand = t.Object(
	{
		opId: ContentStructureBatchOperationId,
		type: t.Literal("nodes.swap"),
		leftNodeId: Uuid,
		rightNodeId: Uuid,
	},
	{ additionalProperties: false },
);
const DeleteContentStructureSubtreeCommand = t.Object(
	{
		opId: ContentStructureBatchOperationId,
		type: t.Literal("node.deleteSubtree"),
		nodeId: Uuid,
	},
	{ additionalProperties: false },
);

export const UpdateContentStructureNodesBatchBody = t.Object(
	{
		baseRevisionId: Uuid,
		changes: t.Array(
			t.Union([
				CreateContentStructureNodeCommand,
				UpdateContentStructureNodeCommand,
				MoveContentStructureNodeCommand,
				SwapContentStructureNodesCommand,
				DeleteContentStructureSubtreeCommand,
			]),
			{ minItems: 1, maxItems: RevisionedBatchCommandLimit },
		),
	},
	{ additionalProperties: false },
);
export type UpdateContentStructureNodesBatchBody = StaticDecode<
	typeof UpdateContentStructureNodesBatchBody
>;

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
export type BookContentStructureParams = StaticDecode<typeof BookContentStructureParams>;
export const BookContentStructureQuery = t.Object(LocalizationLanguageQuery, {
	additionalProperties: false,
});
export type BookContentStructureQuery = StaticDecode<typeof BookContentStructureQuery>;

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

const NewBookContentStructureLabelDraftNode = t.Object(
	{
		state: t.Literal("new"),
		...BookContentStructureDraftNodeBase,
		language: ContentLanguage,
		contentKind: t.Literal("label"),
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
		ownershipMode: t.Optional(t.UnionEnum(UnitOwnershipModeValues, { default: undefined })),
	},
	{ additionalProperties: false },
);

const AttachedBookContentStructureDraftNode = t.Object(
	{
		state: t.Literal("attached"),
		id: Uuid,
		parentId: t.Nullable(Uuid),
		order: t.Integer({ minimum: 0 }),
		contentUnitId: Uuid,
	},
	{ additionalProperties: false },
);

export const SaveBookContentStructureDraftBody = t.Object(
	{
		baseRevisionId: Uuid,
		revisionContext: t.Optional(RevisionContext),
		nodes: t.Array(
			t.Union([
				ExistingBookContentStructureDraftNode,
				NewBookContentStructureLabelDraftNode,
				NewBookContentStructureChapterDraftNode,
				AttachedBookContentStructureDraftNode,
			]),
		),
	},
	{ additionalProperties: false },
);
export type SaveBookContentStructureDraftBody = StaticDecode<
	typeof SaveBookContentStructureDraftBody
>;

export const MediaContentStructureParams = t.Object({ unitId: Uuid });
export type MediaContentStructureParams = StaticDecode<typeof MediaContentStructureParams>;
export const MediaContentStructureQuery = t.Object(LocalizationLanguageQuery, {
	additionalProperties: false,
});
export type MediaContentStructureQuery = StaticDecode<typeof MediaContentStructureQuery>;

const ExistingMediaContentStructureDraftNode = t.Object(
	{
		state: t.Literal("existing"),
		...BookContentStructureDraftNodeBase,
	},
	{ additionalProperties: false },
);

const NewMediaContentStructureDraftNode = t.Object(
	{
		state: t.Literal("new"),
		...BookContentStructureDraftNodeBase,
		language: ContentLanguage,
		contentKind: t.UnionEnum(["video", "audio", "label"]),
	},
	{ additionalProperties: false },
);

const AttachedMediaContentStructureDraftNode = t.Object(
	{
		state: t.Literal("attached"),
		id: Uuid,
		parentId: t.Nullable(Uuid),
		order: t.Integer({ minimum: 0 }),
		contentUnitId: Uuid,
	},
	{ additionalProperties: false },
);

const MediaContentStructureDraftBase = t.Union([
	t.Object({ kind: t.Literal("uninitialized") }, { additionalProperties: false }),
	t.Object({ kind: t.Literal("revision"), revisionId: Uuid }, { additionalProperties: false }),
]);

export const SaveMediaContentStructureDraftBody = t.Object(
	{
		base: MediaContentStructureDraftBase,
		revisionContext: t.Optional(RevisionContext),
		nodes: t.Array(
			t.Union([
				ExistingMediaContentStructureDraftNode,
				NewMediaContentStructureDraftNode,
				AttachedMediaContentStructureDraftNode,
			]),
		),
	},
	{ additionalProperties: false },
);
export type SaveMediaContentStructureDraftBody = StaticDecode<
	typeof SaveMediaContentStructureDraftBody
>;

export const BookChapterNodeParams = t.Object({ bookId: Uuid, nodeId: Uuid });
export type BookChapterNodeParams = StaticDecode<typeof BookChapterNodeParams>;

export const ReadChapterQuery = t.Object(
	{
		...LocalizationLanguageQuery,
		language: t.Optional(ContentLanguage),
	},
	{ additionalProperties: false },
);
export type ReadChapterQuery = StaticDecode<typeof ReadChapterQuery>;

export const ChapterLocalizationParams = t.Object({
	chapterId: Uuid,
	language: ContentLanguage,
});
export type ChapterLocalizationParams = StaticDecode<typeof ChapterLocalizationParams>;

export const UpsertChapterLocalizationBody = t.Object({
	title: t.String({ minLength: 1, maxLength: 500 }),
	content: PortableTextDocument,
	status: t.Union([t.Literal("draft"), t.Literal("published"), t.Literal("archived")]),
	baseRevisionId: Uuid,
	revisionContext: t.Optional(RevisionContext),
});
export type UpsertChapterLocalizationBody = StaticDecode<typeof UpsertChapterLocalizationBody>;
