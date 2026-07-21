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

	constructor(message = "Content Structure violates its purpose schema") {
		super();
		this.message = message;
	}
}
