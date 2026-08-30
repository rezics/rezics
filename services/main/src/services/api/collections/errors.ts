import { StatusCodes } from "http-status-codes";
import { HTTPError } from "elysia";
export { CollectionStructureRevisionConflict } from "../../collection-structure/errors";
import { CollectionStructureRevisionConflict } from "../../collection-structure/errors";

export class CollectionNotFound extends HTTPError.id("CollectionNotFound", StatusCodes.NOT_FOUND) {
	override readonly message = "Collection not found";
}

export class FavoritesEditForbidden extends HTTPError.id(
	"FavoritesEditForbidden",
	StatusCodes.CONFLICT,
) {
	override readonly message = "Favorites cannot be edited";
}

export class FavoritesDeleteForbidden extends HTTPError.id(
	"FavoritesDeleteForbidden",
	StatusCodes.CONFLICT,
) {
	override readonly message = "Favorites cannot be deleted";
}

export const CollectionErrors = [
	CollectionNotFound,
	FavoritesEditForbidden,
	FavoritesDeleteForbidden,
	CollectionStructureRevisionConflict,
] as const;
