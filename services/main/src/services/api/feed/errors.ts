import { StatusCodes } from "http-status-codes";
import * as Data from "effect/Data";

export class InvalidFeedCursor extends Data.TaggedError("InvalidFeedCursor") {
	static readonly status = StatusCodes.BAD_REQUEST as const;
	readonly status = InvalidFeedCursor.status;
	readonly message = "Invalid feed cursor";
}

export class InvalidFeedFilter extends Data.TaggedError("InvalidFeedFilter") {
	static readonly status = StatusCodes.BAD_REQUEST as const;
	readonly status = InvalidFeedFilter.status;
	readonly message = "Invalid feed filter";
}

export const FeedErrors = [InvalidFeedCursor, InvalidFeedFilter] as const;
