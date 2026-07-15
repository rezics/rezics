import { StatusCodes } from "http-status-codes";
import * as Data from "effect/Data";

export class ProgressNotFound extends Data.TaggedError("ProgressNotFound") {
	static readonly status = StatusCodes.NOT_FOUND as const;
	readonly status = ProgressNotFound.status;
	readonly message = "Progress not found";
}

export const ProgressErrors = [ProgressNotFound] as const;
