import { StatusCodes } from "http-status-codes";
import * as Data from "effect/Data";

export class FeedbackRealmMismatch extends Data.TaggedError("FeedbackRealmMismatch") {
	static readonly status = StatusCodes.BAD_REQUEST as const;
	readonly status = FeedbackRealmMismatch.status;
	readonly message = "The feedback target is not in this Realm";
}

export class FeedbackNotFound extends Data.TaggedError("FeedbackNotFound") {
	static readonly status = StatusCodes.NOT_FOUND as const;
	readonly status = FeedbackNotFound.status;
	readonly message = "Feedback not found";
}

export class FeedbackAlreadyResolved extends Data.TaggedError("FeedbackAlreadyResolved") {
	static readonly status = StatusCodes.CONFLICT as const;
	readonly status = FeedbackAlreadyResolved.status;
	readonly message = "Feedback is already resolved";
}

export const FeedbackErrors = [
	FeedbackRealmMismatch,
	FeedbackNotFound,
	FeedbackAlreadyResolved,
] as const;
