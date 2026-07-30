import { StatusCodes } from "http-status-codes";
import * as Data from "effect/Data";

export class UnitOwnershipClaimUnavailable extends Data.TaggedError(
	"UnitOwnershipClaimUnavailable",
) {
	static readonly status = StatusCodes.CONFLICT as const;
	readonly status = UnitOwnershipClaimUnavailable.status;
	readonly message =
		"Ownership claims are available only for supported community-owned public entries";
}

export class UnitOwnershipClaimAlreadyPending extends Data.TaggedError(
	"UnitOwnershipClaimAlreadyPending",
) {
	static readonly status = StatusCodes.CONFLICT as const;
	readonly status = UnitOwnershipClaimAlreadyPending.status;
	readonly message = "This Profile already has a pending ownership claim for the Unit";
}

export class UnitOwnershipClaimNotFound extends Data.TaggedError("UnitOwnershipClaimNotFound") {
	static readonly status = StatusCodes.NOT_FOUND as const;
	readonly status = UnitOwnershipClaimNotFound.status;
	readonly message = "Unit ownership claim not found";
}

export class UnitOwnershipClaimChanged extends Data.TaggedError("UnitOwnershipClaimChanged") {
	static readonly status = StatusCodes.CONFLICT as const;
	readonly status = UnitOwnershipClaimChanged.status;
	readonly message = "The Unit ownership claim or source ownership has changed";
}

export class UnitOwnershipClaimConfirmationInvalid extends Data.TaggedError(
	"UnitOwnershipClaimConfirmationInvalid",
) {
	static readonly status = StatusCodes.BAD_REQUEST as const;
	readonly status = UnitOwnershipClaimConfirmationInvalid.status;
	readonly message = "The ownership claim confirmation does not match the target";
}

export class UnitOwnershipClaimSelfDecisionForbidden extends Data.TaggedError(
	"UnitOwnershipClaimSelfDecisionForbidden",
) {
	static readonly status = StatusCodes.FORBIDDEN as const;
	readonly status = UnitOwnershipClaimSelfDecisionForbidden.status;
	readonly message = "A claimant cannot decide their own Unit ownership claim";
}

export const OwnershipClaimErrors = [
	UnitOwnershipClaimUnavailable,
	UnitOwnershipClaimAlreadyPending,
	UnitOwnershipClaimNotFound,
	UnitOwnershipClaimChanged,
	UnitOwnershipClaimConfirmationInvalid,
	UnitOwnershipClaimSelfDecisionForbidden,
] as const;
