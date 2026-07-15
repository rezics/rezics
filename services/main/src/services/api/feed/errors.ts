import { StatusCodes } from "http-status-codes";
import * as Data from "effect/Data";

export class InvalidFeedCursor extends Data.TaggedError("InvalidFeedCursor") {
	static readonly status = StatusCodes.BAD_REQUEST as const;
	readonly status = InvalidFeedCursor.status;
	readonly message = "Invalid feed cursor";
}

export const FeedErrors = [InvalidFeedCursor] as const;
