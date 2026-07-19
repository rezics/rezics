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

export class ModerationTargetScopeRequired extends Data.TaggedError(
	"ModerationTargetScopeRequired",
) {
	static readonly status = StatusCodes.BAD_REQUEST as const;
	readonly status = ModerationTargetScopeRequired.status;
	readonly message = "Unit protection moderation requires a scope and mode";
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

export class ModerationActionIncompatible extends Data.TaggedError("ModerationActionIncompatible") {
	static readonly status = StatusCodes.BAD_REQUEST as const;
	readonly status = ModerationActionIncompatible.status;
	readonly message = "The moderation action is not valid for this target";
}

export class ModerationTransitionInvalid extends Data.TaggedError("ModerationTransitionInvalid") {
	static readonly status = StatusCodes.CONFLICT as const;
	readonly status = ModerationTransitionInvalid.status;
	readonly message = "The moderation target cannot make that state transition";
}

export class ModerationActionNoEffect extends Data.TaggedError("ModerationActionNoEffect") {
	static readonly status = StatusCodes.CONFLICT as const;
	readonly status = ModerationActionNoEffect.status;
	readonly message = "The moderation action would not change the target";
}

export class ModerationReversalUnavailable extends Data.TaggedError(
	"ModerationReversalUnavailable",
) {
	static readonly status = StatusCodes.CONFLICT as const;
	readonly status = ModerationReversalUnavailable.status;
	readonly message = "The moderation action cannot be reversed from its current state";
}

export class ModerationIdempotencyConflict extends Data.TaggedError(
	"ModerationIdempotencyConflict",
) {
	static readonly status = StatusCodes.CONFLICT as const;
	readonly status = ModerationIdempotencyConflict.status;
	readonly message = "The idempotency key was already used for a different request";
}

export class ModerationNoteRoleDuplicate extends Data.TaggedError("ModerationNoteRoleDuplicate") {
	static readonly status = StatusCodes.BAD_REQUEST as const;
	readonly status = ModerationNoteRoleDuplicate.status;
	readonly message = "A moderation action can create at most one note for each role";
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

export class UnitAccessBindingNotFound extends Data.TaggedError("UnitAccessBindingNotFound") {
	static readonly status = StatusCodes.NOT_FOUND as const;
	readonly status = UnitAccessBindingNotFound.status;
	readonly message = "Unit access binding not found";
}

export class UnitOwnerRequired extends Data.TaggedError("UnitOwnerRequired") {
	static readonly status = StatusCodes.CONFLICT as const;
	readonly status = UnitOwnerRequired.status;
	readonly message = "A Unit must keep at least one owner";
}

export class UnitOwnershipClaimUnavailable extends Data.TaggedError(
	"UnitOwnershipClaimUnavailable",
) {
	static readonly status = StatusCodes.CONFLICT as const;
	readonly status = UnitOwnershipClaimUnavailable.status;
	readonly message = "This Unit is not eligible for ownership claim by the current Profile";
}

export class UnitAccessRestrictionNotFound extends Data.TaggedError(
	"UnitAccessRestrictionNotFound",
) {
	static readonly status = StatusCodes.NOT_FOUND as const;
	readonly status = UnitAccessRestrictionNotFound.status;
	readonly message = "Unit access restriction not found";
}

export class UnitProtectionNotFound extends Data.TaggedError("UnitProtectionNotFound") {
	static readonly status = StatusCodes.NOT_FOUND as const;
	readonly status = UnitProtectionNotFound.status;
	readonly message = "Unit protection not found";
}

export class UnitAccessExpiryInvalid extends Data.TaggedError("UnitAccessExpiryInvalid") {
	static readonly status = StatusCodes.BAD_REQUEST as const;
	readonly status = UnitAccessExpiryInvalid.status;
	readonly message = "Unit access expiry must be in the future";
}

export class UnitAccessBindingConflict extends Data.TaggedError("UnitAccessBindingConflict") {
	static readonly status = StatusCodes.CONFLICT as const;
	readonly status = UnitAccessBindingConflict.status;
	readonly message = "An active binding already exists for this subject and scope";
}

export class UnitAccessSubjectRoleInvalid extends Data.TaggedError("UnitAccessSubjectRoleInvalid") {
	static readonly status = StatusCodes.BAD_REQUEST as const;
	readonly status = UnitAccessSubjectRoleInvalid.status;
	readonly message =
		"Authenticated access can only receive viewer or editor roles, and Realm access cannot own a Unit";
}

export class UnitAccessRestrictionConflict extends Data.TaggedError(
	"UnitAccessRestrictionConflict",
) {
	static readonly status = StatusCodes.CONFLICT as const;
	readonly status = UnitAccessRestrictionConflict.status;
	readonly message =
		"An active restriction already exists for this subject, permission, and scope";
}

export class UnitOwnerRestrictionForbidden extends Data.TaggedError(
	"UnitOwnerRestrictionForbidden",
) {
	static readonly status = StatusCodes.CONFLICT as const;
	readonly status = UnitOwnerRestrictionForbidden.status;
	readonly message = "A Unit owner cannot be restricted";
}

export const GovernanceErrors = [
	ModerationTargetNotFound,
	ModerationRealmMissing,
	ModerationTargetScopeRequired,
	ModerationCaseNotFound,
	ModerationReversalInvalid,
	ModerationReversedActionInvalid,
	ModerationActionIncompatible,
	ModerationTransitionInvalid,
	ModerationActionNoEffect,
	ModerationReversalUnavailable,
	ModerationIdempotencyConflict,
	ModerationNoteRoleDuplicate,
	EnforcementExpiryInvalid,
	EnforcementNotFound,
	EnforcementAlreadyRevoked,
	EnforcementChanged,
	PlatformGrantRealmForbidden,
	RealmGrantRealmRequired,
	RealmGrantCapabilityInvalid,
	CapabilityGrantExpiryInvalid,
	CapabilityGrantNotFound,
	UnitAccessBindingNotFound,
	UnitOwnerRequired,
	UnitOwnershipClaimUnavailable,
	UnitAccessRestrictionNotFound,
	UnitProtectionNotFound,
	UnitAccessExpiryInvalid,
	UnitAccessBindingConflict,
	UnitAccessSubjectRoleInvalid,
	UnitAccessRestrictionConflict,
	UnitOwnerRestrictionForbidden,
] as const;
