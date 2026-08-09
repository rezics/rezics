import { StatusCodes } from "http-status-codes";
import * as Data from "effect/Data";

export class ReportRealmMismatch extends Data.TaggedError("ReportRealmMismatch") {
	static readonly status = StatusCodes.BAD_REQUEST as const;
	readonly status = ReportRealmMismatch.status;
	readonly message = "The reported Unit is not in this Realm";
}

export class ReportAlreadySubmitted extends Data.TaggedError("ReportAlreadySubmitted") {
	static readonly status = StatusCodes.CONFLICT as const;
	readonly status = ReportAlreadySubmitted.status;
	readonly message = "This Unit has already been reported for the active case";
}

export class ReportTargetRevisionUnavailable extends Data.TaggedError(
	"ReportTargetRevisionUnavailable",
) {
	static readonly status = StatusCodes.CONFLICT as const;
	readonly status = ReportTargetRevisionUnavailable.status;
	readonly message = "The reported Unit does not have a current revision";
}

export class ReportRuleUnavailable extends Data.TaggedError("ReportRuleUnavailable") {
	static readonly status = StatusCodes.CONFLICT as const;
	readonly status = ReportRuleUnavailable.status;
	readonly message = "The selected report destination does not have a current rule set";
}

export class ReportRuleChanged extends Data.TaggedError("ReportRuleChanged") {
	static readonly status = StatusCodes.CONFLICT as const;
	readonly status = ReportRuleChanged.status;
	readonly message = "The selected report rule is not part of the current rule revision";
}

export class ReportRuleSourceForbidden extends Data.TaggedError("ReportRuleSourceForbidden") {
	static readonly status = StatusCodes.BAD_REQUEST as const;
	readonly status = ReportRuleSourceForbidden.status;
	readonly message = "Reports may only cite the current Realm and official rules";
}

export const ReportErrors = [
	ReportRealmMismatch,
	ReportAlreadySubmitted,
	ReportTargetRevisionUnavailable,
	ReportRuleUnavailable,
	ReportRuleChanged,
	ReportRuleSourceForbidden,
] as const;
