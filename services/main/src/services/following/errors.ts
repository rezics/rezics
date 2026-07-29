import { StatusCodes } from "http-status-codes";
import * as Data from "effect/Data";

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

export class FollowingTargetKindMismatch extends Data.TaggedError("FollowingTargetKindMismatch") {
	static readonly status = StatusCodes.CONFLICT as const;
	readonly status = FollowingTargetKindMismatch.status;
	readonly message = "The followed Unit kind changed; reload its settings";
}

export const FollowingErrors = [
	UserSelfFollowForbidden,
	UserFollowBlocked,
	FollowingTargetKindMismatch,
] as const;
