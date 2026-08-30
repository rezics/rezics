import { StatusCodes } from "http-status-codes";
import { HTTPError } from "elysia";

export class ApiQuotaPolicyNotFound extends HTTPError.id(
	"ApiQuotaPolicyNotFound",
	StatusCodes.NOT_FOUND,
) {
	override readonly message = "API quota policy not found";
}

export class ApiQuotaPolicyInvalid extends HTTPError.id(
	"ApiQuotaPolicyInvalid",
	StatusCodes.UNPROCESSABLE_ENTITY,
) {
	override readonly message = "API quota policy configuration is invalid";
}

export class ApiQuotaPolicyKeyConflict extends HTTPError.id(
	"ApiQuotaPolicyKeyConflict",
	StatusCodes.CONFLICT,
) {
	override readonly message = "An API quota policy with this key already exists";
}

export class ApiQuotaPolicyRevisionConflict extends HTTPError.id(
	"ApiQuotaPolicyRevisionConflict",
	StatusCodes.CONFLICT,
) {
	override readonly message = "API quota policy changed; reload before saving";
}

export class ApiAccountQuotaRevisionConflict extends HTTPError.id(
	"ApiAccountQuotaRevisionConflict",
	StatusCodes.CONFLICT,
) {
	override readonly message = "Account API quota assignment changed; reload before saving";
}

export class ApiTokenQuotaRevisionConflict extends HTTPError.id(
	"ApiTokenQuotaRevisionConflict",
	StatusCodes.CONFLICT,
) {
	override readonly message = "API token quota assignment changed; reload before saving";
}

export const ApiQuotaPolicyErrors = [
	ApiQuotaPolicyNotFound,
	ApiQuotaPolicyInvalid,
	ApiQuotaPolicyKeyConflict,
	ApiQuotaPolicyRevisionConflict,
	ApiAccountQuotaRevisionConflict,
	ApiTokenQuotaRevisionConflict,
] as const;
