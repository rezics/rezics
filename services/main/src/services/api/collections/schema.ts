import { type Static, t } from "elysia";
import { LifecycleInput, LocalizationInput, Uuid } from "../schema";

export const ListCollectionsQuery = t.Object({
	ownerId: t.Optional(Uuid),
	limit: t.Optional(t.Integer({ minimum: 1, maximum: 50, default: 20 })),
});
export type ListCollectionsQuery = Static<typeof ListCollectionsQuery>;

export const CreateCollectionBody = t.Object({
	slug: t.String({ minLength: 3, maxLength: 72 }),
	localization: LocalizationInput,
	visibility: LifecycleInput.visibility,
});
export type CreateCollectionBody = Static<typeof CreateCollectionBody>;

export const CollectionParams = t.Object({ collectionId: Uuid });
export type CollectionParams = Static<typeof CollectionParams>;

export const UpdateCollectionBody = t.Object({
	status: LifecycleInput.status,
	visibility: LifecycleInput.visibility,
	localization: t.Optional(LocalizationInput),
});
export type UpdateCollectionBody = Static<typeof UpdateCollectionBody>;

export const CollectionItemParams = t.Object({ collectionId: Uuid, targetId: Uuid });
export type CollectionItemParams = Static<typeof CollectionItemParams>;

export const SaveCollectionItemBody = t.Object({
	kind: t.Optional(t.String({ maxLength: 32 })),
	parentTargetId: t.Optional(t.Nullable(Uuid)),
	position: t.Optional(t.String({ maxLength: 128 })),
	searchText: t.Optional(t.String({ maxLength: 1_000 })),
});
export type SaveCollectionItemBody = Static<typeof SaveCollectionItemBody>;

export const FavoriteItemParams = t.Object({ targetId: Uuid });
export type FavoriteItemParams = Static<typeof FavoriteItemParams>;
