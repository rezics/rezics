import { StatusCodes } from "http-status-codes";
import * as Data from "effect/Data";
export { CollectionStructureRevisionConflict } from "../../collection-structure/errors";
import { CollectionStructureRevisionConflict } from "../../collection-structure/errors";

export class CollectionNotFound extends Data.TaggedError("CollectionNotFound") {
	static readonly status = StatusCodes.NOT_FOUND as const;
	readonly status = CollectionNotFound.status;
	readonly message = "Collection not found";
}

export class FavoritesEditForbidden extends Data.TaggedError("FavoritesEditForbidden") {
	static readonly status = StatusCodes.CONFLICT as const;
	readonly status = FavoritesEditForbidden.status;
	readonly message = "Favorites cannot be edited";
}

export class FavoritesDeleteForbidden extends Data.TaggedError("FavoritesDeleteForbidden") {
	static readonly status = StatusCodes.CONFLICT as const;
	readonly status = FavoritesDeleteForbidden.status;
	readonly message = "Favorites cannot be deleted";
}

export const CollectionErrors = [
	CollectionNotFound,
	FavoritesEditForbidden,
	FavoritesDeleteForbidden,
	CollectionStructureRevisionConflict,
] as const;
