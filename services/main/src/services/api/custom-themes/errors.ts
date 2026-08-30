import { StatusCodes } from "http-status-codes";
import type { JsonValue } from "@rezics/portable-text";
import { HTTPError } from "elysia";

export class CustomThemeNotFound extends HTTPError.id(
	"CustomThemeNotFound",
	StatusCodes.NOT_FOUND,
) {
	override readonly message = "Custom Theme not found";
}

export class CustomThemeRevisionNotFound extends HTTPError.id(
	"CustomThemeRevisionNotFound",
	StatusCodes.NOT_FOUND,
) {
	override readonly message = "Custom Theme revision not found";
}

export class CustomThemePackageInvalid extends HTTPError.id(
	"CustomThemePackageInvalid",
	StatusCodes.UNPROCESSABLE_ENTITY,
) {
	override readonly message = "Custom Theme package is invalid";

	constructor(readonly details: JsonValue) {
		super();
	}
}

export class CustomThemeSubmissionBackpressure extends HTTPError.id(
	"CustomThemeSubmissionBackpressure",
	StatusCodes.SERVICE_UNAVAILABLE,
) {
	override readonly message =
		"Custom Theme submissions are temporarily paused while review catches up";
	readonly retryAfterSeconds = 60;

	constructor(readonly details: JsonValue) {
		super();
	}
}

export class CustomThemeExternalResourceInvalid extends HTTPError.id(
	"CustomThemeExternalResourceInvalid",
	StatusCodes.UNPROCESSABLE_ENTITY,
) {
	override readonly message = "A Custom Theme external resource could not be reviewed safely";

	constructor(readonly details?: JsonValue) {
		super();
	}
}

export class CustomThemeReviewEvidenceInvalid extends HTTPError.id(
	"CustomThemeReviewEvidenceInvalid",
	StatusCodes.UNPROCESSABLE_ENTITY,
) {
	override readonly message = "Custom Theme review evidence is incomplete";
}

export class CustomThemeRevisionStateConflict extends HTTPError.id(
	"CustomThemeRevisionStateConflict",
	StatusCodes.CONFLICT,
) {
	override readonly message = "Custom Theme revision is not in the required review state";
}

export class CustomThemeReviewerSeparationRequired extends HTTPError.id(
	"CustomThemeReviewerSeparationRequired",
	StatusCodes.FORBIDDEN,
) {
	override readonly message = "The revision submitter cannot decide its review";
}

export class CustomThemeInstallationInvalid extends HTTPError.id(
	"CustomThemeInstallationInvalid",
	StatusCodes.UNPROCESSABLE_ENTITY,
) {
	override readonly message = "Custom Theme revision is not approved for this host";
}

export class UnitPresentationHostUnsupported extends HTTPError.id(
	"UnitPresentationHostUnsupported",
	StatusCodes.UNPROCESSABLE_ENTITY,
) {
	override readonly message = "This Unit kind does not support the presentation contract";
}

export class UnitPresentationRevisionConflict extends HTTPError.id(
	"UnitPresentationRevisionConflict",
	StatusCodes.CONFLICT,
) {
	override readonly message = "Unit presentation changed after it was loaded";
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
