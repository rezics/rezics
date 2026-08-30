import { StatusCodes } from "http-status-codes";
import type { JsonValue } from "@rezics/portable-text";
import { HTTPError } from "elysia";

export class AccountRestricted extends HTTPError.id("AccountRestricted", StatusCodes.FORBIDDEN) {
	override readonly message = "Account is restricted";
}

export class RealmCapabilityRequired extends HTTPError.id(
	"RealmCapabilityRequired",
	StatusCodes.FORBIDDEN,
) {
	override readonly message = "Realm capability required";
}

export class RealmRulesAcceptanceRequired extends HTTPError.id(
	"RealmRulesAcceptanceRequired",
	StatusCodes.CONFLICT,
) {
	override readonly message = "Current Realm rules must be accepted";

	constructor(readonly details: JsonValue) {
		super();
	}
}

export class PlatformCapabilityRequired extends HTTPError.id(
	"PlatformCapabilityRequired",
	StatusCodes.FORBIDDEN,
) {
	override readonly message = "Platform capability required";
}

export class PlatformAccessManagerRequired extends HTTPError.id(
	"PlatformAccessManagerRequired",
	StatusCodes.CONFLICT,
) {
	override readonly message = "At least one non-expiring platform access manager is required";
}

export class PlatformAccessRevisionConflict extends HTTPError.id(
	"PlatformAccessRevisionConflict",
	StatusCodes.CONFLICT,
) {
	override readonly message = "Platform access changed after it was loaded";
}

export class PlatformAccessConfigurationInvalid extends HTTPError.id(
	"PlatformAccessConfigurationInvalid",
	StatusCodes.BAD_REQUEST,
) {
	override readonly message =
		"The requested platform access configuration exceeds a uniqueness or capacity limit";

	constructor(readonly details?: JsonValue) {
		super();
	}
}

export class CustomThemeExternalLiveAccessSelfMutationForbidden extends HTTPError.id(
	"CustomThemeExternalLiveAccessSelfMutationForbidden",
	StatusCodes.FORBIDDEN,
) {
	override readonly message = "External-live access managers cannot change their own eligibility";
}

export class CollectionOwnershipRequired extends HTTPError.id(
	"CollectionOwnershipRequired",
	StatusCodes.FORBIDDEN,
) {
	override readonly message = "You do not own this collection";
}

export const AuthorizationErrors = [
	AccountRestricted,
	RealmCapabilityRequired,
	RealmRulesAcceptanceRequired,
	PlatformCapabilityRequired,
	PlatformAccessManagerRequired,
	PlatformAccessRevisionConflict,
	PlatformAccessConfigurationInvalid,
	CustomThemeExternalLiveAccessSelfMutationForbidden,
	CollectionOwnershipRequired,
] as const;
