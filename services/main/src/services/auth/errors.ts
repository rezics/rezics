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

export const AuthErrors = [
	AuthenticationRequired,
	ApiTokenPermissionRequired,
	ApiTokenRateLimitExceeded,
	InteractiveSessionRequired,
	FreshSessionRequired,
	EmailVerificationRequired,
] as const;
