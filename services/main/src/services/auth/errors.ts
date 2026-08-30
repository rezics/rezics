import { StatusCodes } from "http-status-codes";
import { HTTPError } from "elysia";

export class AuthenticationRequired extends HTTPError.id(
	"AuthenticationRequired",
	StatusCodes.UNAUTHORIZED,
) {
	override readonly message = "Authentication required";
}

export class ApiTokenPermissionRequired extends HTTPError.id(
	"ApiTokenPermissionRequired",
	StatusCodes.FORBIDDEN,
) {
	override readonly message: string;

	constructor(readonly permission: string) {
		super();
		this.message = `API token requires permission: ${permission}`;
	}
}

export class ApiTokenRateLimitExceeded extends HTTPError.id(
	"ApiTokenRateLimitExceeded",
	StatusCodes.TOO_MANY_REQUESTS,
) {
	override readonly message = "API token rate limit exceeded";

	constructor(readonly retryAfterSeconds: number) {
		super();
	}
}

export type ApiQuotaExceededDetails = {
	dimension: "request_rate" | "concurrency" | "daily_cost";
	subject: "account" | "token";
	scope: string;
	limit: number;
};

export class ApiQuotaExceeded extends HTTPError.id(
	"ApiQuotaExceeded",
	StatusCodes.TOO_MANY_REQUESTS,
) {
	override readonly message = "API quota exceeded";

	constructor(
		readonly retryAfterSeconds: number,
		readonly details: ApiQuotaExceededDetails,
	) {
		super();
	}
}

export class InteractiveSessionRequired extends HTTPError.id(
	"InteractiveSessionRequired",
	StatusCodes.UNAUTHORIZED,
) {
	override readonly message = "An interactive session is required";
}

export class FreshSessionRequired extends HTTPError.id(
	"FreshSessionRequired",
	StatusCodes.FORBIDDEN,
) {
	override readonly message = "Please re-authenticate before managing credentials";
}

export class EmailVerificationRequired extends HTTPError.id(
	"EmailVerificationRequired",
	StatusCodes.FORBIDDEN,
) {
	override readonly message = "Email verification required";
}

export class AccountSuspended extends HTTPError.id("AccountSuspended", StatusCodes.FORBIDDEN) {
	override readonly message = "Account is suspended";

	constructor(readonly suspendedUntil: Date | null) {
		super();
	}
}

export class AccountClosed extends HTTPError.id("AccountClosed", StatusCodes.FORBIDDEN) {
	override readonly message = "Account is closed";
}

export const AuthErrors = [
	AuthenticationRequired,
	ApiTokenPermissionRequired,
	ApiTokenRateLimitExceeded,
	ApiQuotaExceeded,
	InteractiveSessionRequired,
	FreshSessionRequired,
	EmailVerificationRequired,
	AccountSuspended,
	AccountClosed,
] as const;
