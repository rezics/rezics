import { StatusCodes } from "http-status-codes";
import * as Data from "effect/Data";

export class PollOptionsDuplicated extends Data.TaggedError("PollOptionsDuplicated") {
	static readonly status = StatusCodes.BAD_REQUEST as const;
	readonly status = PollOptionsDuplicated.status;
	readonly message = "Poll options must be unique";
}

export class PollNotFound extends Data.TaggedError("PollNotFound") {
	static readonly status = StatusCodes.NOT_FOUND as const;
	readonly status = PollNotFound.status;
	readonly message = "Poll not found";
}

export class PollClosed extends Data.TaggedError("PollClosed") {
	static readonly status = StatusCodes.FORBIDDEN as const;
	readonly status = PollClosed.status;
	readonly message = "Poll is closed";
}

export class PollSingleChoiceInvalid extends Data.TaggedError("PollSingleChoiceInvalid") {
	static readonly status = StatusCodes.BAD_REQUEST as const;
	readonly status = PollSingleChoiceInvalid.status;
	readonly message = "Single-choice poll requires exactly one option";
}

export class PollOptionInvalid extends Data.TaggedError("PollOptionInvalid") {
	static readonly status = StatusCodes.BAD_REQUEST as const;
	readonly status = PollOptionInvalid.status;
	readonly message = "Invalid poll option";
}

export class PollAlreadyClosed extends Data.TaggedError("PollAlreadyClosed") {
	static readonly status = StatusCodes.CONFLICT as const;
	readonly status = PollAlreadyClosed.status;
	readonly message = "Poll is already closed";
}

export const PollErrors = [
	PollOptionsDuplicated,
	PollNotFound,
	PollClosed,
	PollSingleChoiceInvalid,
	PollOptionInvalid,
	PollAlreadyClosed,
] as const;
