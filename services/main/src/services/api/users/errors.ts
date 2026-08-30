import { StatusCodes } from "http-status-codes";
import { HTTPError } from "elysia";

export class ProfileNotFound extends HTTPError.id("ProfileNotFound", StatusCodes.NOT_FOUND) {
	override readonly message = "Profile not found";
}

export class ProfileChanged extends HTTPError.id("ProfileChanged", StatusCodes.CONFLICT) {
	override readonly message = "Profile has changed";
	readonly details: { readonly updatedAt: string };

	constructor(updatedAt: Date) {
		super();
		this.details = { updatedAt: updatedAt.toISOString() };
	}
}

export class PreferencesNotFound extends HTTPError.id(
	"PreferencesNotFound",
	StatusCodes.NOT_FOUND,
) {
	override readonly message = "Preferences not found";
}

export class UserNotFound extends HTTPError.id("UserNotFound", StatusCodes.NOT_FOUND) {
	override readonly message = "User not found";
}

export class UserSelfBlockForbidden extends HTTPError.id(
	"UserSelfBlockForbidden",
	StatusCodes.CONFLICT,
) {
	override readonly message = "You cannot block yourself";
}

export class UserAccountStateRevisionConflict extends HTTPError.id(
	"UserAccountStateRevisionConflict",
	StatusCodes.CONFLICT,
) {
	override readonly message = "Account state changed after it was loaded";
}

export class UserSelfStatusChangeForbidden extends HTTPError.id(
	"UserSelfStatusChangeForbidden",
	StatusCodes.CONFLICT,
) {
	override readonly message = "You cannot suspend or close your own account";
}

export class PlatformUserManagerRequired extends HTTPError.id(
	"PlatformUserManagerRequired",
	StatusCodes.CONFLICT,
) {
	override readonly message = "At least one active platform user manager is required";
}

export class UserAccountStateExpiryInvalid extends HTTPError.id(
	"UserAccountStateExpiryInvalid",
	StatusCodes.UNPROCESSABLE_ENTITY,
) {
	override readonly message = "Suspension expiry must be in the future";
}

export class SessionNotFound extends HTTPError.id("SessionNotFound", StatusCodes.NOT_FOUND) {
	override readonly message = "Session not found";
}

export class StudioRealmSubjectLimitExceeded extends HTTPError.id(
	"StudioRealmSubjectLimitExceeded",
	StatusCodes.UNPROCESSABLE_ENTITY,
) {
	override readonly message = "Studio workspace Realm subject limit exceeded";
	readonly details: { readonly maximum: number };

	constructor(maximum: number) {
		super();
		this.details = { maximum };
	}
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
	StudioRealmSubjectLimitExceeded,
] as const;
