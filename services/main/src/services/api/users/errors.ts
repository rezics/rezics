import { StatusCodes } from "http-status-codes";
import * as Data from "effect/Data";

export class ProfileNotFound extends Data.TaggedError("ProfileNotFound") {
	static readonly status = StatusCodes.NOT_FOUND as const;
	readonly status = ProfileNotFound.status;
	readonly message = "Profile not found";
}

export class ProfileChanged extends Data.TaggedError("ProfileChanged") {
	static readonly status = StatusCodes.CONFLICT as const;
	readonly status = ProfileChanged.status;
	readonly message = "Profile has changed";
	readonly details: { readonly updatedAt: string };

	constructor(updatedAt: Date) {
		super();
		this.details = { updatedAt: updatedAt.toISOString() };
	}
}

export class PreferencesNotFound extends Data.TaggedError("PreferencesNotFound") {
	static readonly status = StatusCodes.NOT_FOUND as const;
	readonly status = PreferencesNotFound.status;
	readonly message = "Preferences not found";
}

export class UserNotFound extends Data.TaggedError("UserNotFound") {
	static readonly status = StatusCodes.NOT_FOUND as const;
	readonly status = UserNotFound.status;
	readonly message = "User not found";
}

export class UserSelfBlockForbidden extends Data.TaggedError("UserSelfBlockForbidden") {
	static readonly status = StatusCodes.CONFLICT as const;
	readonly status = UserSelfBlockForbidden.status;
	readonly message = "You cannot block yourself";
}

export class UserAccountStateRevisionConflict extends Data.TaggedError(
	"UserAccountStateRevisionConflict",
) {
	static readonly status = StatusCodes.CONFLICT as const;
	readonly status = UserAccountStateRevisionConflict.status;
	readonly message = "Account state changed after it was loaded";
}

export class UserSelfStatusChangeForbidden extends Data.TaggedError(
	"UserSelfStatusChangeForbidden",
) {
	static readonly status = StatusCodes.CONFLICT as const;
	readonly status = UserSelfStatusChangeForbidden.status;
	readonly message = "You cannot suspend or close your own account";
}

export class PlatformUserManagerRequired extends Data.TaggedError("PlatformUserManagerRequired") {
	static readonly status = StatusCodes.CONFLICT as const;
	readonly status = PlatformUserManagerRequired.status;
	readonly message = "At least one active platform user manager is required";
}

export class UserAccountStateExpiryInvalid extends Data.TaggedError(
	"UserAccountStateExpiryInvalid",
) {
	static readonly status = StatusCodes.UNPROCESSABLE_ENTITY as const;
	readonly status = UserAccountStateExpiryInvalid.status;
	readonly message = "Suspension expiry must be in the future";
}

export class SessionNotFound extends Data.TaggedError("SessionNotFound") {
	static readonly status = StatusCodes.NOT_FOUND as const;
	readonly status = SessionNotFound.status;
	readonly message = "Session not found";
}

export const UserErrors = [
	ProfileNotFound,
	ProfileChanged,
	PreferencesNotFound,
	UserNotFound,
	UserSelfBlockForbidden,
	UserAccountStateRevisionConflict,
	UserSelfStatusChangeForbidden,
	PlatformUserManagerRequired,
	UserAccountStateExpiryInvalid,
	SessionNotFound,
] as const;
