import { StatusCodes } from "http-status-codes";
import * as Data from "effect/Data";

export class ApiQuotaPolicyNotFound extends Data.TaggedError("ApiQuotaPolicyNotFound") {
	static readonly status = StatusCodes.NOT_FOUND as const;
	readonly status = ApiQuotaPolicyNotFound.status;
	readonly message = "API quota policy not found";
}

export class ApiQuotaPolicyInvalid extends Data.TaggedError("ApiQuotaPolicyInvalid") {
	static readonly status = StatusCodes.UNPROCESSABLE_ENTITY as const;
	readonly status = ApiQuotaPolicyInvalid.status;
	readonly message = "API quota policy configuration is invalid";
}

export class ApiQuotaPolicyKeyConflict extends Data.TaggedError("ApiQuotaPolicyKeyConflict") {
	static readonly status = StatusCodes.CONFLICT as const;
	readonly status = ApiQuotaPolicyKeyConflict.status;
	readonly message = "An API quota policy with this key already exists";
}

export class ApiQuotaPolicyRevisionConflict extends Data.TaggedError(
	"ApiQuotaPolicyRevisionConflict",
) {
	static readonly status = StatusCodes.CONFLICT as const;
	readonly status = ApiQuotaPolicyRevisionConflict.status;
	readonly message = "API quota policy changed; reload before saving";
}

export class ApiAccountQuotaRevisionConflict extends Data.TaggedError(
	"ApiAccountQuotaRevisionConflict",
) {
	static readonly status = StatusCodes.CONFLICT as const;
	readonly status = ApiAccountQuotaRevisionConflict.status;
	readonly message = "Account API quota assignment changed; reload before saving";
}

export class ApiTokenQuotaRevisionConflict extends Data.TaggedError(
	"ApiTokenQuotaRevisionConflict",
) {
	static readonly status = StatusCodes.CONFLICT as const;
	readonly status = ApiTokenQuotaRevisionConflict.status;
	readonly message = "API token quota assignment changed; reload before saving";
}

export const ApiQuotaPolicyErrors = [
	ApiQuotaPolicyNotFound,
	ApiQuotaPolicyInvalid,
	ApiQuotaPolicyKeyConflict,
	ApiQuotaPolicyRevisionConflict,
	ApiAccountQuotaRevisionConflict,
	ApiTokenQuotaRevisionConflict,
] as const;
