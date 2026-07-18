import { StatusCodes } from "http-status-codes";
import * as Data from "effect/Data";

export class ApiTokenNotFound extends Data.TaggedError("ApiTokenNotFound") {
	static readonly status = StatusCodes.NOT_FOUND as const;
	readonly status = ApiTokenNotFound.status;
	readonly message = "Active API token not found";
}

export const TokenErrors = [ApiTokenNotFound] as const;
