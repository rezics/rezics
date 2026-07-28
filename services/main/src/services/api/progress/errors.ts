import { StatusCodes } from "http-status-codes";
import * as Data from "effect/Data";

export class ProgressEntryNotFound extends Data.TaggedError("ProgressEntryNotFound") {
	static readonly status = StatusCodes.NOT_FOUND as const;
	readonly status = ProgressEntryNotFound.status;
	readonly message = "Progress entry not found";
}

export const ProgressErrors = [ProgressEntryNotFound] as const;
