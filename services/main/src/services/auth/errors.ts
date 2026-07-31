import { StatusCodes } from "http-status-codes";
import * as Data from "effect/Data";

export class AuthenticationRequired extends Data.TaggedError("AuthenticationRequired") {
	static readonly status = StatusCodes.UNAUTHORIZED as const;
	readonly status = AuthenticationRequired.status;
	readonly message = "Authentication required";
}

export class ApiTokenPermissionRequired extends Data.TaggedError("ApiTokenPermissionRequired") {
	static readonly status = StatusCodes.FORBIDDEN as const;
	readonly status = ApiTokenPermissionRequired.status;
	readonly message: string;

	constructor(readonly permission: string) {
		super();
		this.message = `API token requires permission: ${permission}`;
	}
}

export class ApiTokenRateLimitExceeded extends Data.TaggedError("ApiTokenRateLimitExceeded") {
	static readonly status = StatusCodes.TOO_MANY_REQUESTS as const;
	readonly status = ApiTokenRateLimitExceeded.status;
	readonly message = "API token rate limit exceeded";

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

export class ApiQuotaExceeded extends Data.TaggedError("ApiQuotaExceeded") {
	static readonly status = StatusCodes.TOO_MANY_REQUESTS as const;
	readonly status = ApiQuotaExceeded.status;
	readonly message = "API quota exceeded";

	constructor(
		readonly retryAfterSeconds: number,
		readonly details: ApiQuotaExceededDetails,
	) {
		super();
	}
}

export class InteractiveSessionRequired extends Data.TaggedError("InteractiveSessionRequired") {
	static readonly status = StatusCodes.UNAUTHORIZED as const;
	readonly status = InteractiveSessionRequired.status;
	readonly message = "An interactive session is required";
}

export class FreshSessionRequired extends Data.TaggedError("FreshSessionRequired") {
	static readonly status = StatusCodes.FORBIDDEN as const;
	readonly status = FreshSessionRequired.status;
	readonly message = "Please re-authenticate before managing credentials";
}

export class EmailVerificationRequired extends Data.TaggedError("EmailVerificationRequired") {
	static readonly status = StatusCodes.FORBIDDEN as const;
	readonly status = EmailVerificationRequired.status;
	readonly message = "Email verification required";
}

export class AccountSuspended extends Data.TaggedError("AccountSuspended") {
	static readonly status = StatusCodes.FORBIDDEN as const;
	readonly status = AccountSuspended.status;
	readonly message = "Account is suspended";

	constructor(readonly suspendedUntil: Date | null) {
		super();
	}
}

export class AccountClosed extends Data.TaggedError("AccountClosed") {
	static readonly status = StatusCodes.FORBIDDEN as const;
	readonly status = AccountClosed.status;
	readonly message = "Account is closed";
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
