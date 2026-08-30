import { StatusCodes } from "http-status-codes";
import { HTTPError } from "elysia";

export class ContentStructureNotFound extends HTTPError.id(
	"ContentStructureNotFound",
	StatusCodes.NOT_FOUND,
) {
	override readonly message = "Content Structure not found";
}

export class ContentStructureInvalid extends HTTPError.id(
	"ContentStructureInvalid",
	StatusCodes.UNPROCESSABLE_ENTITY,
) {
	override readonly message: string;

	constructor(message = "Content Structure violates its kind schema") {
		super();
		this.message = message;
	}
}

export class ContentStructureRevisionConflict extends HTTPError.id(
	"ContentStructureRevisionConflict",
	StatusCodes.CONFLICT,
) {
	override readonly message = "Content Structure revision has changed";
	readonly details: { readonly latestRevisionId: string | null };

	constructor(latestRevisionId: string | null) {
		super();
		this.details = { latestRevisionId };
	}
}
