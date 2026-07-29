import { type Static, t } from "elysia";
import {
	DateTime,
	LifecycleInput,
	LocalizationInput,
	LocalizationLanguageQuery,
	Uuid,
} from "../schema";

export const ListCollectionsQuery = t.Object(
	{
		publisherProfileId: t.Optional(Uuid),
		editableOnly: t.Optional(t.Boolean()),
		targetId: t.Optional(Uuid),
		containsTargetId: t.Optional(Uuid),
		acceptsItemsOnly: t.Optional(t.Boolean()),
		...LocalizationLanguageQuery,
		search: t.Optional(t.String({ minLength: 1, maxLength: 200 })),
		cursor: t.Optional(t.String({ maxLength: 4_096 })),
		limit: t.Optional(t.Integer({ minimum: 1, maximum: 50, default: 20 })),
	},
	{ additionalProperties: false },
);
export type ListCollectionsQuery = Static<typeof ListCollectionsQuery>;

export const CreateCollectionBody = t.Object({
	localization: LocalizationInput,
	visibility: LifecycleInput.visibility,
});
export type CreateCollectionBody = Static<typeof CreateCollectionBody>;

export const CollectionParams = t.Object({ collectionId: Uuid });
export type CollectionParams = Static<typeof CollectionParams>;
export const CollectionDetailQuery = t.Object(LocalizationLanguageQuery, {
	additionalProperties: false,
});
export type CollectionDetailQuery = Static<typeof CollectionDetailQuery>;

export const CollectionItemsQuery = t.Object(
	{
		...LocalizationLanguageQuery,
		cursor: t.Optional(t.String({ maxLength: 4_096 })),
		limit: t.Optional(t.Integer({ minimum: 1, maximum: 100, default: 20 })),
	},
	{ additionalProperties: false },
);
export type CollectionItemsQuery = Static<typeof CollectionItemsQuery>;

export const UpdateCollectionBody = t.Object(
	{
		baseRevisionId: Uuid,
		status: LifecycleInput.status,
		visibility: LifecycleInput.visibility,
		localization: t.Optional(LocalizationInput),
	},
	{ additionalProperties: false },
);
export type UpdateCollectionBody = Static<typeof UpdateCollectionBody>;

export const CollectionItemParams = t.Object({ collectionId: Uuid, targetId: Uuid });
export type CollectionItemParams = Static<typeof CollectionItemParams>;

export const SaveCollectionItemBody = t.Object(
	{
		baseItemsRevisionId: Uuid,
		placement: t.UnionEnum(["direct", "review-with-subject"]),
		parentTargetId: t.Optional(t.Nullable(Uuid)),
	},
	{ additionalProperties: false },
);
export type SaveCollectionItemBody = Static<typeof SaveCollectionItemBody>;

export const AddCollectionItemsBatchBody = t.Object(
	{
		baseItemsRevisionId: Uuid,
		items: t.Array(
			t.Object(
				{
					targetId: Uuid,
				},
				{ additionalProperties: false },
			),
			{ minItems: 1, maxItems: 20, uniqueItems: true },
		),
	},
	{ additionalProperties: false },
);
export type AddCollectionItemsBatchBody = Static<typeof AddCollectionItemsBatchBody>;

export const CollectionItemPlacement = t.Union([
	t.Object(
		{
			kind: t.UnionEnum(["start", "end"]),
			parentTargetId: t.Nullable(Uuid),
		},
		{ additionalProperties: false },
	),
	t.Object(
		{
			kind: t.Literal("after"),
			targetId: Uuid,
		},
		{ additionalProperties: false },
	),
]);
export type CollectionItemPlacement = Static<typeof CollectionItemPlacement>;

export const MoveCollectionItemsBody = t.Object(
	{
		baseItemsRevisionId: Uuid,
		targetIds: t.Array(Uuid, { minItems: 1, maxItems: 100, uniqueItems: true }),
		placement: CollectionItemPlacement,
	},
	{ additionalProperties: false },
);
export type MoveCollectionItemsBody = Static<typeof MoveCollectionItemsBody>;

export const CollectionRevisionBody = t.Object(
	{ baseRevisionId: Uuid },
	{ additionalProperties: false },
);
export type CollectionRevisionBody = Static<typeof CollectionRevisionBody>;

export const CollectionItemsRevisionBody = t.Object(
	{ baseItemsRevisionId: Uuid },
	{ additionalProperties: false },
);
export type CollectionItemsRevisionBody = Static<typeof CollectionItemsRevisionBody>;

export const CollectionStructureRevisionListQuery = t.Object(
	{ limit: t.Optional(t.Integer({ minimum: 1, maximum: 100, default: 50 })) },
	{ additionalProperties: false },
);
export const CollectionStructureRevisionParams = t.Object({
	collectionId: Uuid,
	revisionId: Uuid,
});
export const CollectionStructureRevisionCompareQuery = t.Object(
	{ from: Uuid, to: Uuid },
	{ additionalProperties: false },
);
export const RestoreCollectionStructureRevisionBody = t.Object(
	{
		baseItemsRevisionId: Uuid,
		message: t.Optional(t.String({ maxLength: 500 })),
		minor: t.Optional(t.Boolean({ default: false })),
	},
	{ additionalProperties: false },
);

export const CollectionStructureRevisionSummaryResponse = t.Object({
	id: Uuid,
	parentRevisionId: t.Nullable(Uuid),
	sourceRevisionId: t.Nullable(Uuid),
	actorProfileId: t.Nullable(Uuid),
	kind: t.UnionEnum(["create", "update", "restore"]),
	editSummary: t.Nullable(t.String()),
	minor: t.Boolean(),
	replayByteSize: t.Integer({ minimum: 0 }),
	checkpointByteSize: t.Integer({ minimum: 0 }),
	createdAt: DateTime,
});
export const CollectionStructureRevisionListResponse = t.Object({
	items: t.Array(CollectionStructureRevisionSummaryResponse),
});
export const CollectionStructureRevisionCompareResponse = t.Object({
	fromRevisionId: Uuid,
	toRevisionId: Uuid,
	changes: t.Array(
		t.Object({
			path: t.String(),
			before: t.Optional(t.Unknown()),
			after: t.Optional(t.Unknown()),
		}),
	),
});
export const RestoreCollectionStructureRevisionResponse = t.Object({
	updated: t.Literal(true),
	latestItemsRevisionId: Uuid,
	revisionCreated: t.Boolean(),
});

export const AddCollectionItemsBatchResponse = t.Object({
	items: t.Array(
		t.Object({
			targetId: Uuid,
			state: t.UnionEnum(["created", "existing"]),
		}),
	),
	latestItemsRevisionId: Uuid,
});

export const FavoriteItemParams = t.Object({ targetId: Uuid });
export type FavoriteItemParams = Static<typeof FavoriteItemParams>;
