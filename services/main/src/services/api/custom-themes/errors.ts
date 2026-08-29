import { StatusCodes } from "http-status-codes";
import type { JsonValue } from "@rezics/portable-text";
import * as Data from "effect/Data";

export class CustomThemeNotFound extends Data.TaggedError("CustomThemeNotFound") {
	static readonly status = StatusCodes.NOT_FOUND as const;
	readonly status = CustomThemeNotFound.status;
	readonly message = "Custom Theme not found";
}

export class CustomThemeRevisionNotFound extends Data.TaggedError("CustomThemeRevisionNotFound") {
	static readonly status = StatusCodes.NOT_FOUND as const;
	readonly status = CustomThemeRevisionNotFound.status;
	readonly message = "Custom Theme revision not found";
}

export class CustomThemePackageInvalid extends Data.TaggedError("CustomThemePackageInvalid") {
	static readonly status = StatusCodes.UNPROCESSABLE_ENTITY as const;
	readonly status = CustomThemePackageInvalid.status;
	readonly message = "Custom Theme package is invalid";

	constructor(readonly details: JsonValue) {
		super();
	}
}

export class CustomThemeSubmissionBackpressure extends Data.TaggedError(
	"CustomThemeSubmissionBackpressure",
) {
	static readonly status = StatusCodes.SERVICE_UNAVAILABLE as const;
	readonly status = CustomThemeSubmissionBackpressure.status;
	readonly message = "Custom Theme submissions are temporarily paused while review catches up";
	readonly retryAfterSeconds = 60;

	constructor(readonly details: JsonValue) {
		super();
	}
}

export class CustomThemeExternalResourceInvalid extends Data.TaggedError(
	"CustomThemeExternalResourceInvalid",
) {
	static readonly status = StatusCodes.UNPROCESSABLE_ENTITY as const;
	readonly status = CustomThemeExternalResourceInvalid.status;
	readonly message = "A Custom Theme external resource could not be reviewed safely";

	constructor(readonly details?: JsonValue) {
		super();
	}
}

export class CustomThemeReviewEvidenceInvalid extends Data.TaggedError(
	"CustomThemeReviewEvidenceInvalid",
) {
	static readonly status = StatusCodes.UNPROCESSABLE_ENTITY as const;
	readonly status = CustomThemeReviewEvidenceInvalid.status;
	readonly message = "Custom Theme review evidence is incomplete";
}

export class CustomThemeRevisionStateConflict extends Data.TaggedError(
	"CustomThemeRevisionStateConflict",
) {
	static readonly status = StatusCodes.CONFLICT as const;
	readonly status = CustomThemeRevisionStateConflict.status;
	readonly message = "Custom Theme revision is not in the required review state";
}

export class CustomThemeReviewerSeparationRequired extends Data.TaggedError(
	"CustomThemeReviewerSeparationRequired",
) {
	static readonly status = StatusCodes.FORBIDDEN as const;
	readonly status = CustomThemeReviewerSeparationRequired.status;
	readonly message = "The revision submitter cannot decide its review";
}

export class CustomThemeInstallationInvalid extends Data.TaggedError(
	"CustomThemeInstallationInvalid",
) {
	static readonly status = StatusCodes.UNPROCESSABLE_ENTITY as const;
	readonly status = CustomThemeInstallationInvalid.status;
	readonly message = "Custom Theme revision is not approved for this host";
}

export class UnitPresentationHostUnsupported extends Data.TaggedError(
	"UnitPresentationHostUnsupported",
) {
	static readonly status = StatusCodes.UNPROCESSABLE_ENTITY as const;
	readonly status = UnitPresentationHostUnsupported.status;
	readonly message = "This Unit kind does not support the presentation contract";
}

export class UnitPresentationRevisionConflict extends Data.TaggedError(
	"UnitPresentationRevisionConflict",
) {
	static readonly status = StatusCodes.CONFLICT as const;
	readonly status = UnitPresentationRevisionConflict.status;
	readonly message = "Unit presentation changed after it was loaded";
}

export const CustomThemeErrors = [
	CustomThemeNotFound,
	CustomThemeRevisionNotFound,
	CustomThemePackageInvalid,
	CustomThemeSubmissionBackpressure,
	CustomThemeExternalResourceInvalid,
	CustomThemeReviewEvidenceInvalid,
	CustomThemeRevisionStateConflict,
	CustomThemeReviewerSeparationRequired,
	CustomThemeInstallationInvalid,
	UnitPresentationHostUnsupported,
	UnitPresentationRevisionConflict,
] as const;
