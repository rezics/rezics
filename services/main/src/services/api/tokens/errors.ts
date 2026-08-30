import { StatusCodes } from "http-status-codes";
import { HTTPError } from "elysia";

export class ApiTokenNotFound extends HTTPError.id("ApiTokenNotFound", StatusCodes.NOT_FOUND) {
	override readonly message = "Active API token not found";
}

export class ApiTokenLimitReached extends HTTPError.id(
	"ApiTokenLimitReached",
	StatusCodes.CONFLICT,
) {
	override readonly message = "The account has reached its active API token limit";

	constructor(readonly details: { maxActiveTokens: number }) {
		super();
	}
}

export class ApiTokenQuotaOverrideInvalid extends HTTPError.id(
	"ApiTokenQuotaOverrideInvalid",
	StatusCodes.UNPROCESSABLE_ENTITY,
) {
	override readonly message = "API token quota override is invalid";
}

export class ApiTokenQuotaOverrideRevisionConflict extends HTTPError.id(
	"ApiTokenQuotaOverrideRevisionConflict",
	StatusCodes.CONFLICT,
) {
	override readonly message = "API token quota override changed; reload before saving";
}

export const TokenErrors = [
	ApiTokenNotFound,
	ApiTokenLimitReached,
	ApiTokenQuotaOverrideInvalid,
	ApiTokenQuotaOverrideRevisionConflict,
] as const;
