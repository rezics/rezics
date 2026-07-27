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

export class PlatformGrantManagerRequired extends Data.TaggedError("PlatformGrantManagerRequired") {
	static readonly status = StatusCodes.CONFLICT as const;
	readonly status = PlatformGrantManagerRequired.status;
	readonly message = "At least one non-expiring platform grant manager is required";
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
	PlatformGrantManagerRequired,
	CollectionOwnershipRequired,
] as const;
