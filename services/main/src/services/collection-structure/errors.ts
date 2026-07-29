import { StatusCodes } from "http-status-codes";
import * as Data from "effect/Data";

export class CollectionStructureRevisionConflict extends Data.TaggedError(
	"CollectionStructureRevisionConflict",
) {
	static readonly status = StatusCodes.CONFLICT as const;
	readonly status = CollectionStructureRevisionConflict.status;
	readonly message = "Collection Structure revision has changed";
	readonly details: { readonly latestRevisionId: string | null };

	constructor(latestRevisionId: string | null) {
		super();
		this.details = { latestRevisionId };
	}
}
