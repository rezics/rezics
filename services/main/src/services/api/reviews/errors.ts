import { StatusCodes } from "http-status-codes";
import * as Data from "effect/Data";

export class ReviewRealmRequired extends Data.TaggedError("ReviewRealmRequired") {
	static readonly status = StatusCodes.BAD_REQUEST as const;
	readonly status = ReviewRealmRequired.status;
	readonly message = "realmId is required when scoring a review target";
}

export class ReviewNotFound extends Data.TaggedError("ReviewNotFound") {
	static readonly status = StatusCodes.NOT_FOUND as const;
	readonly status = ReviewNotFound.status;
	readonly message = "Review not found";
}

export const ReviewErrors = [ReviewRealmRequired, ReviewNotFound] as const;
