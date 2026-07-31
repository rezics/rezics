import { StatusCodes } from "http-status-codes";
import * as Data from "effect/Data";

export class ApiTokenNotFound extends Data.TaggedError("ApiTokenNotFound") {
	static readonly status = StatusCodes.NOT_FOUND as const;
	readonly status = ApiTokenNotFound.status;
	readonly message = "Active API token not found";
}

export class ApiTokenLimitReached extends Data.TaggedError("ApiTokenLimitReached") {
	static readonly status = StatusCodes.CONFLICT as const;
	readonly status = ApiTokenLimitReached.status;
	readonly message = "The account has reached its active API token limit";

	constructor(readonly details: { maxActiveTokens: number }) {
		super();
	}
}

export class ApiTokenQuotaOverrideInvalid extends Data.TaggedError("ApiTokenQuotaOverrideInvalid") {
	static readonly status = StatusCodes.UNPROCESSABLE_ENTITY as const;
	readonly status = ApiTokenQuotaOverrideInvalid.status;
	readonly message = "API token quota override is invalid";
}

export class ApiTokenQuotaOverrideRevisionConflict extends Data.TaggedError(
	"ApiTokenQuotaOverrideRevisionConflict",
) {
	static readonly status = StatusCodes.CONFLICT as const;
	readonly status = ApiTokenQuotaOverrideRevisionConflict.status;
	readonly message = "API token quota override changed; reload before saving";
}

export const TokenErrors = [
	ApiTokenNotFound,
	ApiTokenLimitReached,
	ApiTokenQuotaOverrideInvalid,
	ApiTokenQuotaOverrideRevisionConflict,
] as const;
