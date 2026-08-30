import { StatusCodes } from "http-status-codes";
import { HTTPError } from "elysia";

export class CollectionStructureRevisionConflict extends HTTPError.id(
	"CollectionStructureRevisionConflict",
	StatusCodes.CONFLICT,
) {
	override readonly message = "Collection Structure revision has changed";
	readonly details: { readonly latestRevisionId: string | null };

	constructor(latestRevisionId: string | null) {
		super();
		this.details = { latestRevisionId };
	}
}
