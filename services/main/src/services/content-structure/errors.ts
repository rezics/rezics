import { StatusCodes } from "http-status-codes";
import * as Data from "effect/Data";

export class ContentStructureNotFound extends Data.TaggedError("ContentStructureNotFound") {
	static readonly status = StatusCodes.NOT_FOUND as const;
	readonly status = ContentStructureNotFound.status;
	readonly message = "Content Structure not found";
}

export class ContentStructureInvalid extends Data.TaggedError("ContentStructureInvalid") {
	static readonly status = StatusCodes.UNPROCESSABLE_ENTITY as const;
	readonly status = ContentStructureInvalid.status;
	readonly message: string;

	constructor(message = "Content Structure violates its kind schema") {
		super();
		this.message = message;
	}
}

export class ContentStructureRevisionConflict extends Data.TaggedError(
	"ContentStructureRevisionConflict",
) {
	static readonly status = StatusCodes.CONFLICT as const;
	readonly status = ContentStructureRevisionConflict.status;
	readonly message = "Content Structure revision has changed";
	readonly details: { readonly latestRevisionId: string | null };

	constructor(latestRevisionId: string | null) {
		super();
		this.details = { latestRevisionId };
	}
}
