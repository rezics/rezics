import { StatusCodes } from "http-status-codes";
import { HTTPError } from "elysia";

export class InvalidFeedCursor extends HTTPError.id("InvalidFeedCursor", StatusCodes.BAD_REQUEST) {
	override readonly message = "Invalid feed cursor";
}

export class InvalidFeedFilter extends HTTPError.id("InvalidFeedFilter", StatusCodes.BAD_REQUEST) {
	override readonly message = "Invalid feed filter";
}

export const FeedErrors = [InvalidFeedCursor, InvalidFeedFilter] as const;
