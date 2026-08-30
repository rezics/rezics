import { StatusCodes } from "http-status-codes";
import { HTTPError } from "elysia";

export class UserSelfFollowForbidden extends HTTPError.id(
	"UserSelfFollowForbidden",
	StatusCodes.CONFLICT,
) {
	override readonly message = "You cannot follow yourself";
}

export class UserFollowBlocked extends HTTPError.id("UserFollowBlocked", StatusCodes.CONFLICT) {
	override readonly message = "Following is unavailable between blocked users";
}

export class FollowingTargetKindMismatch extends HTTPError.id(
	"FollowingTargetKindMismatch",
	StatusCodes.CONFLICT,
) {
	override readonly message = "The followed Unit kind changed; reload its settings";
}

export const FollowingErrors = [
	UserSelfFollowForbidden,
	UserFollowBlocked,
	FollowingTargetKindMismatch,
] as const;
