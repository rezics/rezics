import { StatusCodes } from "http-status-codes";
import * as Data from "effect/Data";

export class ModerationTargetNotFound extends Data.TaggedError("ModerationTargetNotFound") {
	static readonly status = StatusCodes.NOT_FOUND as const;
	readonly status = ModerationTargetNotFound.status;
	readonly message = "Moderation target not found";
}

export class ModerationRealmMissing extends Data.TaggedError("ModerationRealmMissing") {
	static readonly status = StatusCodes.BAD_REQUEST as const;
	readonly status = ModerationRealmMissing.status;
	readonly message = "Realm moderation case is missing its Realm";
}

export class ModerationTargetPathRequired extends Data.TaggedError("ModerationTargetPathRequired") {
	static readonly status = StatusCodes.BAD_REQUEST as const;
	readonly status = ModerationTargetPathRequired.status;
	readonly message = "Field moderation requires a target path";
}

export class ModerationCaseNotFound extends Data.TaggedError("ModerationCaseNotFound") {
	static readonly status = StatusCodes.NOT_FOUND as const;
	readonly status = ModerationCaseNotFound.status;
	readonly message = "Moderation case not found";
}

export class ModerationReversalInvalid extends Data.TaggedError("ModerationReversalInvalid") {
	static readonly status = StatusCodes.BAD_REQUEST as const;
	readonly status = ModerationReversalInvalid.status;
	readonly message = "reversesActionId is required exactly for reverse actions";
}

export class ModerationReversedActionInvalid extends Data.TaggedError(
	"ModerationReversedActionInvalid",
) {
	static readonly status = StatusCodes.BAD_REQUEST as const;
	readonly status = ModerationReversedActionInvalid.status;
	readonly message = "The reversed action must belong to this case";
}

export class EnforcementExpiryInvalid extends Data.TaggedError("EnforcementExpiryInvalid") {
	static readonly status = StatusCodes.BAD_REQUEST as const;
	readonly status = EnforcementExpiryInvalid.status;
	readonly message = "expiresAt must be in the future";
}

export class EnforcementNotFound extends Data.TaggedError("EnforcementNotFound") {
	static readonly status = StatusCodes.NOT_FOUND as const;
	readonly status = EnforcementNotFound.status;
	readonly message = "Enforcement not found";
}

export class EnforcementAlreadyRevoked extends Data.TaggedError("EnforcementAlreadyRevoked") {
	static readonly status = StatusCodes.CONFLICT as const;
	readonly status = EnforcementAlreadyRevoked.status;
	readonly message = "Enforcement is already revoked";
}

export class EnforcementChanged extends Data.TaggedError("EnforcementChanged") {
	static readonly status = StatusCodes.CONFLICT as const;
	readonly status = EnforcementChanged.status;
	readonly message = "Enforcement was already changed";
}

export class PlatformGrantRealmForbidden extends Data.TaggedError("PlatformGrantRealmForbidden") {
	static readonly status = StatusCodes.BAD_REQUEST as const;
	readonly status = PlatformGrantRealmForbidden.status;
	readonly message = "Platform grants cannot have a Realm";
}

export class RealmGrantRealmRequired extends Data.TaggedError("RealmGrantRealmRequired") {
	static readonly status = StatusCodes.BAD_REQUEST as const;
	readonly status = RealmGrantRealmRequired.status;
	readonly message = "Realm grants require realmId";
}

export class RealmGrantCapabilityInvalid extends Data.TaggedError("RealmGrantCapabilityInvalid") {
	static readonly status = StatusCodes.BAD_REQUEST as const;
	readonly status = RealmGrantCapabilityInvalid.status;
	readonly message = "Capability is not valid for a Realm grant";
}

export class CapabilityGrantExpiryInvalid extends Data.TaggedError("CapabilityGrantExpiryInvalid") {
	static readonly status = StatusCodes.BAD_REQUEST as const;
	readonly status = CapabilityGrantExpiryInvalid.status;
	readonly message = "expiresAt must be in the future";
}

export class CapabilityGrantNotFound extends Data.TaggedError("CapabilityGrantNotFound") {
	static readonly status = StatusCodes.NOT_FOUND as const;
	readonly status = CapabilityGrantNotFound.status;
	readonly message = "Active capability grant not found";
}

export class CollaboratorNotFound extends Data.TaggedError("CollaboratorNotFound") {
	static readonly status = StatusCodes.NOT_FOUND as const;
	readonly status = CollaboratorNotFound.status;
	readonly message = "Collaborator not found";
}

export class UnitOwnerRequired extends Data.TaggedError("UnitOwnerRequired") {
	static readonly status = StatusCodes.CONFLICT as const;
	readonly status = UnitOwnerRequired.status;
	readonly message = "A Unit must keep at least one owner";
}

export class FieldLockNotFound extends Data.TaggedError("FieldLockNotFound") {
	static readonly status = StatusCodes.NOT_FOUND as const;
	readonly status = FieldLockNotFound.status;
	readonly message = "Field lock not found";
}

export const GovernanceErrors = [
	ModerationTargetNotFound,
	ModerationRealmMissing,
	ModerationTargetPathRequired,
	ModerationCaseNotFound,
	ModerationReversalInvalid,
	ModerationReversedActionInvalid,
	EnforcementExpiryInvalid,
	EnforcementNotFound,
	EnforcementAlreadyRevoked,
	EnforcementChanged,
	PlatformGrantRealmForbidden,
	RealmGrantRealmRequired,
	RealmGrantCapabilityInvalid,
	CapabilityGrantExpiryInvalid,
	CapabilityGrantNotFound,
	CollaboratorNotFound,
	UnitOwnerRequired,
	FieldLockNotFound,
] as const;
