import { StatusCodes } from "http-status-codes";
import * as Data from "effect/Data";

export class AuthenticationRequired extends Data.TaggedError("AuthenticationRequired") {
	static readonly status = StatusCodes.UNAUTHORIZED as const;
	readonly status = AuthenticationRequired.status;
	readonly message = "Authentication required";
}

export class ApiTokenScopeRequired extends Data.TaggedError("ApiTokenScopeRequired") {
	static readonly status = StatusCodes.FORBIDDEN as const;
	readonly status = ApiTokenScopeRequired.status;
	readonly message: string;

	constructor(readonly scope: string) {
		super();
		this.message = `API token requires scope: ${scope}`;
	}
}

export class EmailVerificationRequired extends Data.TaggedError("EmailVerificationRequired") {
	static readonly status = StatusCodes.FORBIDDEN as const;
	readonly status = EmailVerificationRequired.status;
	readonly message = "Email verification required";
}

export const AuthErrors = [
	AuthenticationRequired,
	ApiTokenScopeRequired,
	EmailVerificationRequired,
] as const;
