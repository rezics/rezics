import { StatusCodes } from "http-status-codes";
import type { JsonValue } from "@rezics/portable-text";
import * as Data from "effect/Data";

export class AccountRestricted extends Data.TaggedError("AccountRestricted") {
	static readonly status = StatusCodes.FORBIDDEN as const;
	readonly status = AccountRestricted.status;
	readonly message = "Account is restricted";
}

export class RealmCapabilityRequired extends Data.TaggedError("RealmCapabilityRequired") {
	static readonly status = StatusCodes.FORBIDDEN as const;
	readonly status = RealmCapabilityRequired.status;
	readonly message = "Realm capability required";
}

export class RealmRulesAcceptanceRequired extends Data.TaggedError("RealmRulesAcceptanceRequired") {
	static readonly status = StatusCodes.CONFLICT as const;
	readonly status = RealmRulesAcceptanceRequired.status;
	readonly message = "Current Realm rules must be accepted";

	constructor(readonly details: JsonValue) {
		super();
	}
}

export class PlatformCapabilityRequired extends Data.TaggedError("PlatformCapabilityRequired") {
	static readonly status = StatusCodes.FORBIDDEN as const;
	readonly status = PlatformCapabilityRequired.status;
	readonly message = "Platform capability required";
}

export class PlatformAccessManagerRequired extends Data.TaggedError(
	"PlatformAccessManagerRequired",
) {
	static readonly status = StatusCodes.CONFLICT as const;
	readonly status = PlatformAccessManagerRequired.status;
	readonly message = "At least one non-expiring platform access manager is required";
}

export class PlatformAccessRevisionConflict extends Data.TaggedError(
	"PlatformAccessRevisionConflict",
) {
	static readonly status = StatusCodes.CONFLICT as const;
	readonly status = PlatformAccessRevisionConflict.status;
	readonly message = "Platform access changed after it was loaded";
}

export class PlatformAccessConfigurationInvalid extends Data.TaggedError(
	"PlatformAccessConfigurationInvalid",
) {
	static readonly status = StatusCodes.BAD_REQUEST as const;
	readonly status = PlatformAccessConfigurationInvalid.status;
	readonly message = "Each platform capability may appear at most once";
}

export class CollectionOwnershipRequired extends Data.TaggedError("CollectionOwnershipRequired") {
	static readonly status = StatusCodes.FORBIDDEN as const;
	readonly status = CollectionOwnershipRequired.status;
	readonly message = "You do not own this collection";
}

export const AuthorizationErrors = [
	AccountRestricted,
	RealmCapabilityRequired,
	RealmRulesAcceptanceRequired,
	PlatformCapabilityRequired,
	PlatformAccessManagerRequired,
	PlatformAccessRevisionConflict,
	PlatformAccessConfigurationInvalid,
	CollectionOwnershipRequired,
] as const;
