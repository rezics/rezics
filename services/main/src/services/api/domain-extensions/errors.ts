import { StatusCodes } from "http-status-codes";
import * as Data from "effect/Data";

export class SoftwareSystemRequirementSourceInvalid extends Data.TaggedError(
	"SoftwareSystemRequirementSourceInvalid",
) {
	static readonly status = StatusCodes.BAD_REQUEST as const;
	readonly status = SoftwareSystemRequirementSourceInvalid.status;
	readonly message = "System requirement source link must belong to this Software";
}

export class SeriesReleaseNotFound extends Data.TaggedError("SeriesReleaseNotFound") {
	static readonly status = StatusCodes.NOT_FOUND as const;
	readonly status = SeriesReleaseNotFound.status;
	readonly message = "Series release not found";
}

export class ZonePageNotFound extends Data.TaggedError("ZonePageNotFound") {
	static readonly status = StatusCodes.NOT_FOUND as const;
	readonly status = ZonePageNotFound.status;
	readonly message = "Zone page not found";
}

export class ZoneTimeRangeInvalid extends Data.TaggedError("ZoneTimeRangeInvalid") {
	static readonly status = StatusCodes.BAD_REQUEST as const;
	readonly status = ZoneTimeRangeInvalid.status;
	readonly message = "Zone endsAt must be later than startsAt";
}

export class SoftwareNotFound extends Data.TaggedError("SoftwareNotFound") {
	static readonly status = StatusCodes.NOT_FOUND as const;
	readonly status = SoftwareNotFound.status;
	readonly message = "Software not found";
}

export class SystemRequirementNotFound extends Data.TaggedError("SystemRequirementNotFound") {
	static readonly status = StatusCodes.NOT_FOUND as const;
	readonly status = SystemRequirementNotFound.status;
	readonly message = "System requirement not found";
}

export const DomainExtensionErrors = [
	SoftwareSystemRequirementSourceInvalid,
	SeriesReleaseNotFound,
	ZonePageNotFound,
	ZoneTimeRangeInvalid,
	SoftwareNotFound,
	SystemRequirementNotFound,
] as const;
