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

export const ReportErrors = [
	ReportRealmMismatch,
	ReportAlreadySubmitted,
	ReportTargetRevisionUnavailable,
] as const;
