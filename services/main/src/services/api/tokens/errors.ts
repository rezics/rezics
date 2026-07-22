import { StatusCodes } from "http-status-codes";
import * as Data from "effect/Data";

export class ApiTokenNotFound extends Data.TaggedError("ApiTokenNotFound") {
	static readonly status = StatusCodes.NOT_FOUND as const;
	readonly status = ApiTokenNotFound.status;
	readonly message = "Active API token not found";
}

export class ApiTokenPolicyInvalid extends Data.TaggedError("ApiTokenPolicyInvalid") {
	static readonly status = StatusCodes.UNPROCESSABLE_ENTITY as const;
	readonly status = ApiTokenPolicyInvalid.status;
	readonly message = "API token policy configuration is invalid";
}

export class ApiTokenPolicyRevisionConflict extends Data.TaggedError(
	"ApiTokenPolicyRevisionConflict",
) {
	static readonly status = StatusCodes.CONFLICT as const;
	readonly status = ApiTokenPolicyRevisionConflict.status;
	readonly message = "API token policy changed; reload before saving";
}

export class ApiTokenPolicyNotFound extends Data.TaggedError("ApiTokenPolicyNotFound") {
	static readonly status = StatusCodes.NOT_FOUND as const;
	readonly status = ApiTokenPolicyNotFound.status;
	readonly message = "API token policy not found";
}

export const TokenErrors = [
	ApiTokenNotFound,
	ApiTokenPolicyInvalid,
	ApiTokenPolicyRevisionConflict,
	ApiTokenPolicyNotFound,
] as const;
