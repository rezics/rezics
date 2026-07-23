import { StatusCodes } from "http-status-codes";
import * as Data from "effect/Data";

export class TagNotFound extends Data.TaggedError("TagNotFound") {
	static readonly status = StatusCodes.NOT_FOUND as const;
	readonly status = TagNotFound.status;
	readonly message = "Tag not found";
}

export const TagErrors = [TagNotFound] as const;
