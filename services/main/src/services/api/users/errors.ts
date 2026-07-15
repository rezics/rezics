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

export class UserSelfFollowForbidden extends Data.TaggedError("UserSelfFollowForbidden") {
	static readonly status = StatusCodes.CONFLICT as const;
	readonly status = UserSelfFollowForbidden.status;
	readonly message = "You cannot follow yourself";
}

export class UserFollowBlocked extends Data.TaggedError("UserFollowBlocked") {
	static readonly status = StatusCodes.CONFLICT as const;
	readonly status = UserFollowBlocked.status;
	readonly message = "Following is unavailable between blocked users";
}

export class UserSelfBlockForbidden extends Data.TaggedError("UserSelfBlockForbidden") {
	static readonly status = StatusCodes.CONFLICT as const;
	readonly status = UserSelfBlockForbidden.status;
	readonly message = "You cannot block yourself";
}

export const UserErrors = [
	ProfileNotFound,
	ProfileChanged,
	PreferencesNotFound,
	UserNotFound,
	UserSelfFollowForbidden,
	UserFollowBlocked,
	UserSelfBlockForbidden,
] as const;
