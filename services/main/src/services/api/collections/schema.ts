import { type Static, t } from "elysia";
import { CollectionDefinitionDocument, CollectionPresentationDocument } from "@rezics/block";
import {
	FractionalPosition,
	LifecycleInput,
	LocalizationInput,
	LocalizationLanguageQuery,
	Uuid,
} from "../schema";

export const CollectionItemRole = t.UnionEnum(["item", "featured", "favorite"]);
export type CollectionItemRole = Static<typeof CollectionItemRole>;

export const ListCollectionsQuery = t.Object(
	{
		ownerId: t.Optional(Uuid),
		targetId: t.Optional(Uuid),
		...LocalizationLanguageQuery,
		limit: t.Optional(t.Integer({ minimum: 1, maximum: 50, default: 20 })),
	},
	{ additionalProperties: false },
);
export type ListCollectionsQuery = Static<typeof ListCollectionsQuery>;

export const CreateCollectionBody = t.Object({
	localization: LocalizationInput,
	visibility: LifecycleInput.visibility,
	definitionDocument: t.Optional(CollectionDefinitionDocument),
	presentationDocument: t.Optional(CollectionPresentationDocument),
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
		definitionDocument: t.Optional(CollectionDefinitionDocument),
		presentationDocument: t.Optional(CollectionPresentationDocument),
	},
	{ additionalProperties: false },
);
export type UpdateCollectionBody = Static<typeof UpdateCollectionBody>;

export const CollectionItemParams = t.Object({ collectionId: Uuid, targetId: Uuid });
export type CollectionItemParams = Static<typeof CollectionItemParams>;

export const SaveCollectionItemBody = t.Object(
	{
		baseRevisionId: Uuid,
		placement: t.UnionEnum(["direct", "review-with-subject"]),
		role: t.Optional(CollectionItemRole),
		parentTargetId: t.Optional(t.Nullable(Uuid)),
		position: t.Optional(FractionalPosition),
	},
	{ additionalProperties: false },
);
export type SaveCollectionItemBody = Static<typeof SaveCollectionItemBody>;

export const AddCollectionItemsBatchBody = t.Object(
	{
		baseRevisionId: Uuid,
		items: t.Array(
			t.Object(
				{
					targetId: Uuid,
					role: t.Optional(CollectionItemRole),
				},
				{ additionalProperties: false },
			),
			{ minItems: 1, maxItems: 20, uniqueItems: true },
		),
	},
	{ additionalProperties: false },
);
export type AddCollectionItemsBatchBody = Static<typeof AddCollectionItemsBatchBody>;

export const CollectionRevisionBody = t.Object(
	{ baseRevisionId: Uuid },
	{ additionalProperties: false },
);
export type CollectionRevisionBody = Static<typeof CollectionRevisionBody>;

export const AddCollectionItemsBatchResponse = t.Object({
	items: t.Array(
		t.Object({
			targetId: Uuid,
			state: t.UnionEnum(["created", "existing"]),
		}),
	),
});

export const FavoriteItemParams = t.Object({ targetId: Uuid });
export type FavoriteItemParams = Static<typeof FavoriteItemParams>;
