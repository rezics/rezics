import { StatusCodes } from "http-status-codes";
import * as Data from "effect/Data";

export class ReviewNotFound extends Data.TaggedError("ReviewNotFound") {
	static readonly status = StatusCodes.NOT_FOUND as const;
	readonly status = ReviewNotFound.status;
	readonly message = "Review not found";
}

export const ReviewErrors = [ReviewNotFound] as const;
