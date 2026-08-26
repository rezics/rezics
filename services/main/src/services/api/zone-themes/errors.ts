import { StatusCodes } from "http-status-codes";
import type { JsonValue } from "@rezics/portable-text";
import * as Data from "effect/Data";

export class ZoneThemeNotFound extends Data.TaggedError("ZoneThemeNotFound") {
	static readonly status = StatusCodes.NOT_FOUND as const;
	readonly status = ZoneThemeNotFound.status;
	readonly message = "Zone theme not found";
}

export class ZoneThemeRevisionNotFound extends Data.TaggedError("ZoneThemeRevisionNotFound") {
	static readonly status = StatusCodes.NOT_FOUND as const;
	readonly status = ZoneThemeRevisionNotFound.status;
	readonly message = "Zone theme revision not found";
}

export class ZoneThemeStylesheetInvalid extends Data.TaggedError("ZoneThemeStylesheetInvalid") {
	static readonly status = StatusCodes.UNPROCESSABLE_ENTITY as const;
	readonly status = ZoneThemeStylesheetInvalid.status;
	readonly message = "Zone theme stylesheet failed automated static review";

	constructor(readonly details: JsonValue) {
		super();
	}
}

export class ZoneThemeAssetsInvalid extends Data.TaggedError("ZoneThemeAssetsInvalid") {
	static readonly status = StatusCodes.UNPROCESSABLE_ENTITY as const;
	readonly status = ZoneThemeAssetsInvalid.status;
	readonly message = "Zone theme assets must be owned, public, ready, and undeleted";
}

export class ZoneThemeAutomatedReviewInvalid extends Data.TaggedError(
	"ZoneThemeAutomatedReviewInvalid",
) {
	static readonly status = StatusCodes.UNPROCESSABLE_ENTITY as const;
	readonly status = ZoneThemeAutomatedReviewInvalid.status;
	readonly message = "Zone theme automated review evidence does not pass the release gate";
}

export class ZoneThemeRevisionStateConflict extends Data.TaggedError(
	"ZoneThemeRevisionStateConflict",
) {
	static readonly status = StatusCodes.CONFLICT as const;
	readonly status = ZoneThemeRevisionStateConflict.status;
	readonly message = "Zone theme revision is not in the required review state";
}

export class ZoneThemeReferenceInvalid extends Data.TaggedError("ZoneThemeReferenceInvalid") {
	static readonly status = StatusCodes.BAD_REQUEST as const;
	readonly status = ZoneThemeReferenceInvalid.status;
	readonly message = "Zone custom theme reference is not approved and active";
}

export const ZoneThemeErrors = [
	ZoneThemeNotFound,
	ZoneThemeRevisionNotFound,
	ZoneThemeStylesheetInvalid,
	ZoneThemeAssetsInvalid,
	ZoneThemeAutomatedReviewInvalid,
	ZoneThemeRevisionStateConflict,
	ZoneThemeReferenceInvalid,
] as const;
