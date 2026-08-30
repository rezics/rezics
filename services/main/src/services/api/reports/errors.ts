import { StatusCodes } from "http-status-codes";
import { HTTPError } from "elysia";

export class ReportRealmMismatch extends HTTPError.id(
	"ReportRealmMismatch",
	StatusCodes.BAD_REQUEST,
) {
	override readonly message = "The reported Unit is not in this Realm";
}

export class ReportAlreadySubmitted extends HTTPError.id(
	"ReportAlreadySubmitted",
	StatusCodes.CONFLICT,
) {
	override readonly message = "This Unit has already been reported for the active case";
}

export class ReportTargetRevisionUnavailable extends HTTPError.id(
	"ReportTargetRevisionUnavailable",
	StatusCodes.CONFLICT,
) {
	override readonly message = "The reported Unit does not have a current revision";
}

export class ReportRuleUnavailable extends HTTPError.id(
	"ReportRuleUnavailable",
	StatusCodes.CONFLICT,
) {
	override readonly message = "The selected report destination does not have a current rule set";
}

export class ReportRuleChanged extends HTTPError.id("ReportRuleChanged", StatusCodes.CONFLICT) {
	override readonly message = "The selected report rule is not part of the current rule revision";
}

export class ReportRuleSourceForbidden extends HTTPError.id(
	"ReportRuleSourceForbidden",
	StatusCodes.BAD_REQUEST,
) {
	override readonly message = "Reports may only cite the current Realm and official rules";
}

export const ReportErrors = [
	ReportRealmMismatch,
	ReportAlreadySubmitted,
	ReportTargetRevisionUnavailable,
	ReportRuleUnavailable,
	ReportRuleChanged,
	ReportRuleSourceForbidden,
] as const;
