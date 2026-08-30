import { StatusCodes } from "http-status-codes";
import { HTTPError } from "elysia";

export class GovernanceNoteNotFound extends HTTPError.id(
	"GovernanceNoteNotFound",
	StatusCodes.NOT_FOUND,
) {
	override readonly message = "Governance note not found";
}

export class ContentGovernanceTargetNotFound extends HTTPError.id(
	"ContentGovernanceTargetNotFound",
	StatusCodes.NOT_FOUND,
) {
	override readonly message = "Content governance target not found";
}

export class ContentReviewRealmMissing extends HTTPError.id(
	"ContentReviewRealmMissing",
	StatusCodes.BAD_REQUEST,
) {
	override readonly message = "Realm content review case is missing its Realm";
}

export class ContentReviewCaseNotFound extends HTTPError.id(
	"ContentReviewCaseNotFound",
	StatusCodes.NOT_FOUND,
) {
	override readonly message = "Content review case not found";
}

export class ContentGovernanceReversedActionInvalid extends HTTPError.id(
	"ContentGovernanceReversedActionInvalid",
	StatusCodes.BAD_REQUEST,
) {
	override readonly message = "The reversed action must belong to this case";
}

export class ContentGovernanceActionIncompatible extends HTTPError.id(
	"ContentGovernanceActionIncompatible",
	StatusCodes.BAD_REQUEST,
) {
	override readonly message = "The content governance action is not valid for this target";
}

export class ContentGovernanceTransitionInvalid extends HTTPError.id(
	"ContentGovernanceTransitionInvalid",
	StatusCodes.CONFLICT,
) {
	override readonly message = "The content governance target cannot make that state transition";
}

export class ContentGovernanceActionNoEffect extends HTTPError.id(
	"ContentGovernanceActionNoEffect",
	StatusCodes.CONFLICT,
) {
	override readonly message = "The content governance action would not change the target";
}

export class ContentGovernanceReversalUnavailable extends HTTPError.id(
	"ContentGovernanceReversalUnavailable",
	StatusCodes.CONFLICT,
) {
	override readonly message =
		"The content governance action cannot be reversed from its current state";
}

export class ContentGovernanceIdempotencyConflict extends HTTPError.id(
	"ContentGovernanceIdempotencyConflict",
	StatusCodes.CONFLICT,
) {
	override readonly message = "The idempotency key was already used for a different request";
}

export class GovernanceNoteRoleDuplicate extends HTTPError.id(
	"GovernanceNoteRoleDuplicate",
	StatusCodes.BAD_REQUEST,
) {
	override readonly message = "A governance operation can create at most one note for each role";
}

export class GovernanceRuleSourceForbidden extends HTTPError.id(
	"GovernanceRuleSourceForbidden",
	StatusCodes.BAD_REQUEST,
) {
	override readonly message = "The selected Rule source is outside this governance authority";
}

export class GovernanceRuleChanged extends HTTPError.id(
	"GovernanceRuleChanged",
	StatusCodes.CONFLICT,
) {
	override readonly message = "A selected rule is no longer part of the current rule revision";
}

export class GovernanceReversalUnavailable extends HTTPError.id(
	"GovernanceReversalUnavailable",
	StatusCodes.CONFLICT,
) {
	override readonly message =
		"The governance decision has already been reversed or does not match the target";
}

export class EnforcementExpiryInvalid extends HTTPError.id(
	"EnforcementExpiryInvalid",
	StatusCodes.BAD_REQUEST,
) {
	override readonly message = "expiresAt must be in the future";
}

export class EnforcementNotFound extends HTTPError.id(
	"EnforcementNotFound",
	StatusCodes.NOT_FOUND,
) {
	override readonly message = "Enforcement not found";
}

export class EnforcementAlreadyRevoked extends HTTPError.id(
	"EnforcementAlreadyRevoked",
	StatusCodes.CONFLICT,
) {
	override readonly message = "Enforcement is already revoked";
}

export class EnforcementChanged extends HTTPError.id("EnforcementChanged", StatusCodes.CONFLICT) {
	override readonly message = "Enforcement was already changed";
}

export class CapabilityGrantExpiryInvalid extends HTTPError.id(
	"CapabilityGrantExpiryInvalid",
	StatusCodes.BAD_REQUEST,
) {
	override readonly message = "expiresAt must be in the future";
}

export class CapabilityGrantNotFound extends HTTPError.id(
	"CapabilityGrantNotFound",
	StatusCodes.NOT_FOUND,
) {
	override readonly message = "Active capability grant not found";
}

export class UnitAccessExpiryInvalid extends HTTPError.id(
	"UnitAccessExpiryInvalid",
	StatusCodes.BAD_REQUEST,
) {
	override readonly message = "Unit access expiry must be in the future";
}

export class UnitAccessInvitationNotFound extends HTTPError.id(
	"UnitAccessInvitationNotFound",
	StatusCodes.NOT_FOUND,
) {
	override readonly message = "Unit access invitation not found";
}

export class UnitAccessInvitationConflict extends HTTPError.id(
	"UnitAccessInvitationConflict",
	StatusCodes.CONFLICT,
) {
	override readonly message = "A matching active Unit access invitation already exists";
}

export class UnitAccessInvitationExpired extends HTTPError.id(
	"UnitAccessInvitationExpired",
	StatusCodes.CONFLICT,
) {
	override readonly message = "Unit access invitation has expired";
}

export class UnitAccessInvitationSelfForbidden extends HTTPError.id(
	"UnitAccessInvitationSelfForbidden",
	StatusCodes.BAD_REQUEST,
) {
	override readonly message = "A Profile cannot invite itself to Unit access";
}

export class UnitAccessConfigurationInvalid extends HTTPError.id(
	"UnitAccessConfigurationInvalid",
	StatusCodes.BAD_REQUEST,
) {
	override readonly message =
		"The selected permissions are not valid for this Unit or authorization subject";
}

export class UnitOwnerRestrictionForbidden extends HTTPError.id(
	"UnitOwnerRestrictionForbidden",
	StatusCodes.CONFLICT,
) {
	override readonly message =
		"Owner access is governed by ownership and cannot have direct overrides";
}

export class UnitOwnershipChanged extends HTTPError.id(
	"UnitOwnershipChanged",
	StatusCodes.CONFLICT,
) {
	override readonly message = "Unit ownership changed before the operation completed";
}

export class UnitOwnershipTargetIneligible extends HTTPError.id(
	"UnitOwnershipTargetIneligible",
	StatusCodes.CONFLICT,
) {
	override readonly message = "The selected Profile is not eligible to receive Unit ownership";
}

export class UnitOwnershipRelinquishmentForbidden extends HTTPError.id(
	"UnitOwnershipRelinquishmentForbidden",
	StatusCodes.CONFLICT,
) {
	override readonly message = "Community ownership cannot be relinquished";
}

export class UnitOwnershipOverrideConfirmationInvalid extends HTTPError.id(
	"UnitOwnershipOverrideConfirmationInvalid",
	StatusCodes.BAD_REQUEST,
) {
	override readonly message = "The Unit ownership override confirmation does not match the target";
}

export class UnitLifecycleConfirmationInvalid extends HTTPError.id(
	"UnitLifecycleConfirmationInvalid",
	StatusCodes.BAD_REQUEST,
) {
	override readonly message = "The Unit lifecycle confirmation does not match the target";
}

export class UnitLifecycleChanged extends HTTPError.id(
	"UnitLifecycleChanged",
	StatusCodes.CONFLICT,
) {
	override readonly message = "The Unit changed before the lifecycle operation completed";
}

export class UnitLifecycleProtected extends HTTPError.id(
	"UnitLifecycleProtected",
	StatusCodes.CONFLICT,
) {
	override readonly message = "Bootstrap and current administrator Units cannot be soft-deleted";
}

export class UnitAlreadyDeleted extends HTTPError.id("UnitAlreadyDeleted", StatusCodes.CONFLICT) {
	override readonly message = "The Unit is already soft-deleted";
}

export class UnitNotDeleted extends HTTPError.id("UnitNotDeleted", StatusCodes.CONFLICT) {
	override readonly message = "The Unit is not soft-deleted";
}

export class UnitMergeNotFound extends HTTPError.id("UnitMergeNotFound", StatusCodes.NOT_FOUND) {
	override readonly message = "Unit merge request not found";
}

export class UnitMergeConfirmationInvalid extends HTTPError.id(
	"UnitMergeConfirmationInvalid",
	StatusCodes.BAD_REQUEST,
) {
	override readonly message = "The Unit merge confirmations do not match the source and target";
}

export class UnitMergeKindIneligible extends HTTPError.id(
	"UnitMergeKindIneligible",
	StatusCodes.UNPROCESSABLE_ENTITY,
) {
	override readonly message = "This Unit kind is not eligible for identity merge";
}

export class UnitMergeKindMismatch extends HTTPError.id(
	"UnitMergeKindMismatch",
	StatusCodes.CONFLICT,
) {
	override readonly message = "Source and target Units must have the same kind";
}

export class UnitMergeRequestConflict extends HTTPError.id(
	"UnitMergeRequestConflict",
	StatusCodes.CONFLICT,
) {
	override readonly message = "The source Unit already has an active or completed merge";
}

export type UnitMergeMeasurementConflictReason =
	| "differing_collision"
	| "self_context"
	| "context_limit";

export class UnitMergeMeasurementConflict extends HTTPError.id(
	"UnitMergeMeasurementConflict",
	StatusCodes.CONFLICT,
) {
	override readonly message = "Unit merge cannot preserve all Entity measurement evidence";
	readonly reason: UnitMergeMeasurementConflictReason;
	readonly contextualCount?: number;
	readonly details: {
		readonly reason: UnitMergeMeasurementConflictReason;
		readonly contextualCount?: number;
	};

	constructor(details: {
		readonly reason: UnitMergeMeasurementConflictReason;
		readonly contextualCount?: number;
	}) {
		super();
		this.reason = details.reason;
		if (details.contextualCount !== undefined) this.contextualCount = details.contextualCount;
		this.details = details;
	}
}

export class UnitMergeIdempotencyConflict extends HTTPError.id(
	"UnitMergeIdempotencyConflict",
	StatusCodes.CONFLICT,
) {
	override readonly message = "The Unit merge idempotency key was used for a different command";
}

export class UnitMergeManifestStale extends HTTPError.id(
	"UnitMergeManifestStale",
	StatusCodes.CONFLICT,
) {
	override readonly message =
		"The source, target, or Variant graph changed after this merge was proposed";
}

export class UnitMergeReviewSelfForbidden extends HTTPError.id(
	"UnitMergeReviewSelfForbidden",
	StatusCodes.FORBIDDEN,
) {
	override readonly message = "A Unit merge proposer cannot review their own request";
}

export class UnitMergeReviewDuplicate extends HTTPError.id(
	"UnitMergeReviewDuplicate",
	StatusCodes.CONFLICT,
) {
	override readonly message = "This Profile has already reviewed the Unit merge request";
}

export class UnitMergeReviewFingerprintMismatch extends HTTPError.id(
	"UnitMergeReviewFingerprintMismatch",
	StatusCodes.CONFLICT,
) {
	override readonly message =
		"The Unit merge review was submitted against an older request manifest";
}

export class UnitMergeRequestNotPending extends HTTPError.id(
	"UnitMergeRequestNotPending",
	StatusCodes.CONFLICT,
) {
	override readonly message = "The Unit merge request is no longer pending review";
}

export class UnitMergeRequestExpired extends HTTPError.id(
	"UnitMergeRequestExpired",
	StatusCodes.CONFLICT,
) {
	override readonly message = "The Unit merge request has expired";
}

export class UnitMergeRetryUnavailable extends HTTPError.id(
	"UnitMergeRetryUnavailable",
	StatusCodes.CONFLICT,
) {
	override readonly message = "This Unit merge operation cannot be retried in its current state";
}

export const GovernanceErrors = [
	GovernanceNoteNotFound,
	ContentGovernanceTargetNotFound,
	ContentReviewRealmMissing,
	ContentReviewCaseNotFound,
	ContentGovernanceReversedActionInvalid,
	ContentGovernanceActionIncompatible,
	ContentGovernanceTransitionInvalid,
	ContentGovernanceActionNoEffect,
	ContentGovernanceReversalUnavailable,
	ContentGovernanceIdempotencyConflict,
	GovernanceNoteRoleDuplicate,
	GovernanceRuleSourceForbidden,
	GovernanceRuleChanged,
	GovernanceReversalUnavailable,
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
	UnitMergeNotFound,
	UnitMergeConfirmationInvalid,
	UnitMergeKindIneligible,
	UnitMergeKindMismatch,
	UnitMergeRequestConflict,
	UnitMergeMeasurementConflict,
	UnitMergeIdempotencyConflict,
	UnitMergeManifestStale,
	UnitMergeReviewSelfForbidden,
	UnitMergeReviewDuplicate,
	UnitMergeReviewFingerprintMismatch,
	UnitMergeRequestNotPending,
	UnitMergeRequestExpired,
	UnitMergeRetryUnavailable,
] as const;
