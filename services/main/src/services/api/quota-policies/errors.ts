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
	ApiQuotaPolicyRevisionConflict,
	ApiAccountQuotaRevisionConflict,
	ApiTokenQuotaRevisionConflict,
] as const;
