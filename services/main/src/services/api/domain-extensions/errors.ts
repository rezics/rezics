import { StatusCodes } from "http-status-codes";
import { HTTPError } from "elysia";

export class SoftwareSystemRequirementSourceInvalid extends HTTPError.id(
	"SoftwareSystemRequirementSourceInvalid",
	StatusCodes.BAD_REQUEST,
) {
	override readonly message = "System requirement external link must belong to this Software";
}

export class SeriesReleaseNotFound extends HTTPError.id(
	"SeriesReleaseNotFound",
	StatusCodes.NOT_FOUND,
) {
	override readonly message = "Series release not found";
}

export class ZonePageNotFound extends HTTPError.id("ZonePageNotFound", StatusCodes.NOT_FOUND) {
	override readonly message = "Zone page not found";
}

export class ZonePageInUse extends HTTPError.id("ZonePageInUse", StatusCodes.CONFLICT) {
	override readonly message =
		"Zone page is still referenced by page-structure, a Block, or a navigation document";
}

export class ZoneNavigationNotFound extends HTTPError.id(
	"ZoneNavigationNotFound",
	StatusCodes.NOT_FOUND,
) {
	override readonly message = "Zone navigation not found";
}

export class ZoneNavigationInUse extends HTTPError.id("ZoneNavigationInUse", StatusCodes.CONFLICT) {
	override readonly message = "Zone navigation is still referenced by a Block document";
}

export class ZoneDocumentInvalid extends HTTPError.id(
	"ZoneDocumentInvalid",
	StatusCodes.BAD_REQUEST,
) {
	override readonly message = "Zone Block or navigation document is invalid";
}

export class ZoneTimeRangeInvalid extends HTTPError.id(
	"ZoneTimeRangeInvalid",
	StatusCodes.BAD_REQUEST,
) {
	override readonly message = "Zone endsAt must be later than startsAt";
}

export class ZoneRuleRealmInvalid extends HTTPError.id(
	"ZoneRuleRealmInvalid",
	StatusCodes.BAD_REQUEST,
) {
	override readonly message =
		"Zone local Rule Realm must have a current revision with at least one Rule";
}

export class SoftwareNotFound extends HTTPError.id("SoftwareNotFound", StatusCodes.NOT_FOUND) {
	override readonly message = "Software not found";
}

export class SystemRequirementNotFound extends HTTPError.id(
	"SystemRequirementNotFound",
	StatusCodes.NOT_FOUND,
) {
	override readonly message = "System requirement not found";
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
