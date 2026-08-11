import { StatusCodes } from "http-status-codes";
import * as Data from "effect/Data";

export class SoftwareSystemRequirementSourceInvalid extends Data.TaggedError(
	"SoftwareSystemRequirementSourceInvalid",
) {
	static readonly status = StatusCodes.BAD_REQUEST as const;
	readonly status = SoftwareSystemRequirementSourceInvalid.status;
	readonly message = "System requirement external link must belong to this Software";
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

export class ZonePageInUse extends Data.TaggedError("ZonePageInUse") {
	static readonly status = StatusCodes.CONFLICT as const;
	readonly status = ZonePageInUse.status;
	readonly message =
		"Zone page is still referenced by page-structure, a Block, or a navigation document";
}

export class ZoneNavigationNotFound extends Data.TaggedError("ZoneNavigationNotFound") {
	static readonly status = StatusCodes.NOT_FOUND as const;
	readonly status = ZoneNavigationNotFound.status;
	readonly message = "Zone navigation not found";
}

export class ZoneNavigationInUse extends Data.TaggedError("ZoneNavigationInUse") {
	static readonly status = StatusCodes.CONFLICT as const;
	readonly status = ZoneNavigationInUse.status;
	readonly message = "Zone navigation is still referenced by a Block document";
}

export class ZoneDocumentInvalid extends Data.TaggedError("ZoneDocumentInvalid") {
	static readonly status = StatusCodes.BAD_REQUEST as const;
	readonly status = ZoneDocumentInvalid.status;
	readonly message = "Zone Block or navigation document is invalid";
}

export class ZoneTimeRangeInvalid extends Data.TaggedError("ZoneTimeRangeInvalid") {
	static readonly status = StatusCodes.BAD_REQUEST as const;
	readonly status = ZoneTimeRangeInvalid.status;
	readonly message = "Zone endsAt must be later than startsAt";
}

export class ZoneRuleRealmInvalid extends Data.TaggedError("ZoneRuleRealmInvalid") {
	static readonly status = StatusCodes.BAD_REQUEST as const;
	readonly status = ZoneRuleRealmInvalid.status;
	readonly message = "Zone local Rule Realm must have a current revision with at least one Rule";
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
	ZonePageInUse,
	ZoneNavigationNotFound,
	ZoneNavigationInUse,
	ZoneDocumentInvalid,
	ZoneTimeRangeInvalid,
	ZoneRuleRealmInvalid,
	SoftwareNotFound,
	SystemRequirementNotFound,
] as const;
