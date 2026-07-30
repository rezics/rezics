import { StatusCodes } from "http-status-codes";
import * as Data from "effect/Data";

export class GovernanceNoteNotFound extends Data.TaggedError("GovernanceNoteNotFound") {
	static readonly status = StatusCodes.NOT_FOUND as const;
	readonly status = GovernanceNoteNotFound.status;
	readonly message = "Governance note not found";
}

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

export class UnitAccessExpiryInvalid extends Data.TaggedError("UnitAccessExpiryInvalid") {
	static readonly status = StatusCodes.BAD_REQUEST as const;
	readonly status = UnitAccessExpiryInvalid.status;
	readonly message = "Unit access expiry must be in the future";
}

export class UnitAccessInvitationNotFound extends Data.TaggedError("UnitAccessInvitationNotFound") {
	static readonly status = StatusCodes.NOT_FOUND as const;
	readonly status = UnitAccessInvitationNotFound.status;
	readonly message = "Unit access invitation not found";
}

export class UnitAccessInvitationConflict extends Data.TaggedError("UnitAccessInvitationConflict") {
	static readonly status = StatusCodes.CONFLICT as const;
	readonly status = UnitAccessInvitationConflict.status;
	readonly message = "A matching active Unit access invitation already exists";
}

export class UnitAccessInvitationExpired extends Data.TaggedError("UnitAccessInvitationExpired") {
	static readonly status = StatusCodes.CONFLICT as const;
	readonly status = UnitAccessInvitationExpired.status;
	readonly message = "Unit access invitation has expired";
}

export class UnitAccessInvitationSelfForbidden extends Data.TaggedError(
	"UnitAccessInvitationSelfForbidden",
) {
	static readonly status = StatusCodes.BAD_REQUEST as const;
	readonly status = UnitAccessInvitationSelfForbidden.status;
	readonly message = "A Profile cannot invite itself to Unit access";
}

export class UnitAccessConfigurationInvalid extends Data.TaggedError(
	"UnitAccessConfigurationInvalid",
) {
	static readonly status = StatusCodes.BAD_REQUEST as const;
	readonly status = UnitAccessConfigurationInvalid.status;
	readonly message =
		"The selected permissions are not valid for this Unit or authorization subject";
}

export class UnitOwnerRestrictionForbidden extends Data.TaggedError(
	"UnitOwnerRestrictionForbidden",
) {
	static readonly status = StatusCodes.CONFLICT as const;
	readonly status = UnitOwnerRestrictionForbidden.status;
	readonly message = "Owner access is governed by ownership and cannot have direct overrides";
}

export class UnitOwnershipChanged extends Data.TaggedError("UnitOwnershipChanged") {
	static readonly status = StatusCodes.CONFLICT as const;
	readonly status = UnitOwnershipChanged.status;
	readonly message = "Unit ownership changed before the operation completed";
}

export class UnitOwnershipTargetIneligible extends Data.TaggedError(
	"UnitOwnershipTargetIneligible",
) {
	static readonly status = StatusCodes.CONFLICT as const;
	readonly status = UnitOwnershipTargetIneligible.status;
	readonly message = "The selected Profile is not eligible to receive Unit ownership";
}

export class UnitOwnershipRelinquishmentForbidden extends Data.TaggedError(
	"UnitOwnershipRelinquishmentForbidden",
) {
	static readonly status = StatusCodes.CONFLICT as const;
	readonly status = UnitOwnershipRelinquishmentForbidden.status;
	readonly message = "Community ownership cannot be relinquished";
}

export class UnitOwnershipOverrideConfirmationInvalid extends Data.TaggedError(
	"UnitOwnershipOverrideConfirmationInvalid",
) {
	static readonly status = StatusCodes.BAD_REQUEST as const;
	readonly status = UnitOwnershipOverrideConfirmationInvalid.status;
	readonly message = "The Unit ownership override confirmation does not match the target";
}

export class UnitLifecycleConfirmationInvalid extends Data.TaggedError(
	"UnitLifecycleConfirmationInvalid",
) {
	static readonly status = StatusCodes.BAD_REQUEST as const;
	readonly status = UnitLifecycleConfirmationInvalid.status;
	readonly message = "The Unit lifecycle confirmation does not match the target";
}

export class UnitLifecycleChanged extends Data.TaggedError("UnitLifecycleChanged") {
	static readonly status = StatusCodes.CONFLICT as const;
	readonly status = UnitLifecycleChanged.status;
	readonly message = "The Unit changed before the lifecycle operation completed";
}

export class UnitLifecycleProtected extends Data.TaggedError("UnitLifecycleProtected") {
	static readonly status = StatusCodes.CONFLICT as const;
	readonly status = UnitLifecycleProtected.status;
	readonly message = "Bootstrap and current administrator Units cannot be soft-deleted";
}

export class UnitAlreadyDeleted extends Data.TaggedError("UnitAlreadyDeleted") {
	static readonly status = StatusCodes.CONFLICT as const;
	readonly status = UnitAlreadyDeleted.status;
	readonly message = "The Unit is already soft-deleted";
}

export class UnitNotDeleted extends Data.TaggedError("UnitNotDeleted") {
	static readonly status = StatusCodes.CONFLICT as const;
	readonly status = UnitNotDeleted.status;
	readonly message = "The Unit is not soft-deleted";
}

export const GovernanceErrors = [
	GovernanceNoteNotFound,
	ModerationTargetNotFound,
	ModerationRealmMissing,
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
	CapabilityGrantExpiryInvalid,
	CapabilityGrantNotFound,
	UnitAccessExpiryInvalid,
	UnitAccessInvitationNotFound,
	UnitAccessInvitationConflict,
	UnitAccessInvitationExpired,
	UnitAccessInvitationSelfForbidden,
	UnitAccessConfigurationInvalid,
	UnitOwnerRestrictionForbidden,
	UnitOwnershipChanged,
	UnitOwnershipTargetIneligible,
	UnitOwnershipRelinquishmentForbidden,
	UnitOwnershipOverrideConfirmationInvalid,
	UnitLifecycleConfirmationInvalid,
	UnitLifecycleChanged,
	UnitLifecycleProtected,
	UnitAlreadyDeleted,
	UnitNotDeleted,
] as const;
