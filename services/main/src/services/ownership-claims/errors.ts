import { StatusCodes } from "http-status-codes";
import { HTTPError } from "elysia";

export class UnitOwnershipClaimUnavailable extends HTTPError.id(
	"UnitOwnershipClaimUnavailable",
	StatusCodes.CONFLICT,
) {
	override readonly message =
		"Ownership claims are available only for supported community-owned public entries";
}

export class UnitOwnershipClaimAlreadyPending extends HTTPError.id(
	"UnitOwnershipClaimAlreadyPending",
	StatusCodes.CONFLICT,
) {
	override readonly message = "This Profile already has a pending ownership claim for the Unit";
}

export class UnitOwnershipClaimNotFound extends HTTPError.id(
	"UnitOwnershipClaimNotFound",
	StatusCodes.NOT_FOUND,
) {
	override readonly message = "Unit ownership claim not found";
}

export class UnitOwnershipClaimChanged extends HTTPError.id(
	"UnitOwnershipClaimChanged",
	StatusCodes.CONFLICT,
) {
	override readonly message = "The Unit ownership claim or source ownership has changed";
}

export class UnitOwnershipClaimConfirmationInvalid extends HTTPError.id(
	"UnitOwnershipClaimConfirmationInvalid",
	StatusCodes.BAD_REQUEST,
) {
	override readonly message = "The ownership claim confirmation does not match the target";
}

export class UnitOwnershipClaimSelfDecisionForbidden extends HTTPError.id(
	"UnitOwnershipClaimSelfDecisionForbidden",
	StatusCodes.FORBIDDEN,
) {
	override readonly message = "A claimant cannot decide their own Unit ownership claim";
}

export const OwnershipClaimErrors = [
	UnitOwnershipClaimUnavailable,
	UnitOwnershipClaimAlreadyPending,
	UnitOwnershipClaimNotFound,
	UnitOwnershipClaimChanged,
	UnitOwnershipClaimConfirmationInvalid,
	UnitOwnershipClaimSelfDecisionForbidden,
] as const;
