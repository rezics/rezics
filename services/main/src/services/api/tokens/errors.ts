import { StatusCodes } from "http-status-codes";
import * as Data from "effect/Data";

export class ApiTokenReadScopeRequired extends Data.TaggedError("ApiTokenReadScopeRequired") {
	static readonly status = StatusCodes.BAD_REQUEST as const;
	readonly status = ApiTokenReadScopeRequired.status;
	readonly message = "API token scopes must include read";
}

export class ApiTokenExpiryInvalid extends Data.TaggedError("ApiTokenExpiryInvalid") {
	static readonly status = StatusCodes.BAD_REQUEST as const;
	readonly status = ApiTokenExpiryInvalid.status;
	readonly message = "expiresAt must be in the future";
}

export class ApiTokenNotFound extends Data.TaggedError("ApiTokenNotFound") {
	static readonly status = StatusCodes.NOT_FOUND as const;
	readonly status = ApiTokenNotFound.status;
	readonly message = "Active API token not found";
}

export const TokenErrors = [
	ApiTokenReadScopeRequired,
	ApiTokenExpiryInvalid,
	ApiTokenNotFound,
] as const;
