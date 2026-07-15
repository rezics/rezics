import { StatusCodes } from "http-status-codes";
import * as Data from "effect/Data";

export class InvalidPaginationCursor extends Data.TaggedError("InvalidPaginationCursor") {
	static readonly status = StatusCodes.BAD_REQUEST as const;
	readonly status = InvalidPaginationCursor.status;
	readonly message = "Invalid pagination cursor";
}

export const PaginationErrors = [InvalidPaginationCursor] as const;
