import { StatusCodes } from "http-status-codes";
import { HTTPError } from "elysia";

export class PollOptionsDuplicated extends HTTPError.id(
	"PollOptionsDuplicated",
	StatusCodes.BAD_REQUEST,
) {
	override readonly message = "Poll options must be unique";
}

export class PollNotFound extends HTTPError.id("PollNotFound", StatusCodes.NOT_FOUND) {
	override readonly message = "Poll not found";
}

export class PollClosed extends HTTPError.id("PollClosed", StatusCodes.FORBIDDEN) {
	override readonly message = "Poll is closed";
}

export class PollSingleChoiceInvalid extends HTTPError.id(
	"PollSingleChoiceInvalid",
	StatusCodes.BAD_REQUEST,
) {
	override readonly message = "Single-choice poll requires exactly one option";
}

export class PollOptionInvalid extends HTTPError.id("PollOptionInvalid", StatusCodes.BAD_REQUEST) {
	override readonly message = "Invalid poll option";
}

export class PollAlreadyClosed extends HTTPError.id("PollAlreadyClosed", StatusCodes.CONFLICT) {
	override readonly message = "Poll is already closed";
}

export const PollErrors = [
	PollOptionsDuplicated,
	PollNotFound,
	PollClosed,
	PollSingleChoiceInvalid,
	PollOptionInvalid,
	PollAlreadyClosed,
] as const;
