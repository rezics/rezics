import { StatusCodes } from "http-status-codes";
import * as Data from "effect/Data";

export class GameSystemRequirementSourceInvalid extends Data.TaggedError(
	"GameSystemRequirementSourceInvalid",
) {
	static readonly status = StatusCodes.BAD_REQUEST as const;
	readonly status = GameSystemRequirementSourceInvalid.status;
	readonly message = "System requirement source link must belong to this Game";
}

export class SeriesReleaseNotFound extends Data.TaggedError("SeriesReleaseNotFound") {
	static readonly status = StatusCodes.NOT_FOUND as const;
	readonly status = SeriesReleaseNotFound.status;
	readonly message = "Series release not found";
}

export class SeriesReleaseRangeInvalid extends Data.TaggedError("SeriesReleaseRangeInvalid") {
	static readonly status = StatusCodes.BAD_REQUEST as const;
	readonly status = SeriesReleaseRangeInvalid.status;
	readonly message = "endsAt must be later than startsAt";
}

export class ZonePageNotFound extends Data.TaggedError("ZonePageNotFound") {
	static readonly status = StatusCodes.NOT_FOUND as const;
	readonly status = ZonePageNotFound.status;
	readonly message = "Zone page not found";
}

export class GameNotFound extends Data.TaggedError("GameNotFound") {
	static readonly status = StatusCodes.NOT_FOUND as const;
	readonly status = GameNotFound.status;
	readonly message = "Game not found";
}

export class SystemRequirementNotFound extends Data.TaggedError("SystemRequirementNotFound") {
	static readonly status = StatusCodes.NOT_FOUND as const;
	readonly status = SystemRequirementNotFound.status;
	readonly message = "System requirement not found";
}

export const DomainExtensionErrors = [
	GameSystemRequirementSourceInvalid,
	SeriesReleaseNotFound,
	SeriesReleaseRangeInvalid,
	ZonePageNotFound,
	GameNotFound,
	SystemRequirementNotFound,
] as const;
