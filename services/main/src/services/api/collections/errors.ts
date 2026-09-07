import { StatusCodes } from "http-status-codes";
import { HTTPError } from "elysia";
export { CollectionStructureRevisionConflict } from "../../collection-structure/errors";
import { CollectionStructureRevisionConflict } from "../../collection-structure/errors";

export class CollectionNotFound extends HTTPError.id("CollectionNotFound", StatusCodes.NOT_FOUND) {
	override readonly message = "Collection not found";
}

export const CollectionErrors = [CollectionNotFound, CollectionStructureRevisionConflict] as const;
