import { type Static, t } from "elysia";
import { CollectionDefinitionDocument, CollectionPresentationDocument } from "@rezics/block";
import {
	FractionalPosition,
	LifecycleInput,
	LocalizationInput,
	LocalizationLanguageQuery,
	Uuid,
} from "../schema";

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

export const UpdateCollectionBody = t.Object({
	status: LifecycleInput.status,
	visibility: LifecycleInput.visibility,
	localization: t.Optional(LocalizationInput),
	definitionDocument: t.Optional(CollectionDefinitionDocument),
	presentationDocument: t.Optional(CollectionPresentationDocument),
});
export type UpdateCollectionBody = Static<typeof UpdateCollectionBody>;

export const CollectionItemParams = t.Object({ collectionId: Uuid, targetId: Uuid });
export type CollectionItemParams = Static<typeof CollectionItemParams>;

export const SaveCollectionItemBody = t.Object({
	kind: t.Optional(t.String({ maxLength: 32 })),
	parentTargetId: t.Optional(t.Nullable(Uuid)),
	position: t.Optional(FractionalPosition),
	searchText: t.Optional(t.String({ maxLength: 1_000 })),
});
export type SaveCollectionItemBody = Static<typeof SaveCollectionItemBody>;

export const AddCollectionItemsBatchBody = t.Object(
	{
		items: t.Array(
			t.Object(
				{
					targetId: Uuid,
					kind: t.Optional(t.String({ minLength: 1, maxLength: 32 })),
				},
				{ additionalProperties: false },
			),
			{ minItems: 1, maxItems: 20, uniqueItems: true },
		),
	},
	{ additionalProperties: false },
);
export type AddCollectionItemsBatchBody = Static<typeof AddCollectionItemsBatchBody>;

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
