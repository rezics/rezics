import { StatusCodes } from "http-status-codes";
import { HTTPError } from "elysia";

export class AliasNotFound extends HTTPError.id("AliasNotFound", StatusCodes.NOT_FOUND) {
	override readonly message = "Alias not found";
}

export class TagApplicationNotFound extends HTTPError.id(
	"TagApplicationNotFound",
	StatusCodes.NOT_FOUND,
) {
	override readonly message: string;

	constructor(afterUpsert = false) {
		super();
		this.message = afterUpsert
			? "Tag application not found after upsert"
			: "Tag application not found";
	}
}

export class UnitTagCurationChanged extends HTTPError.id(
	"UnitTagCurationChanged",
	StatusCodes.CONFLICT,
) {
	override readonly message = "Unit Tag curation has changed";
	readonly details: { readonly currentFeaturedTagIds: string[] };

	constructor(currentFeaturedTagIds: readonly string[]) {
		super();
		this.details = { currentFeaturedTagIds: [...currentFeaturedTagIds] };
	}
}

export class UnitExternalLinkNotFound extends HTTPError.id(
	"UnitExternalLinkNotFound",
	StatusCodes.NOT_FOUND,
) {
	override readonly message = "Unit external link not found";
}

export class UnitReferenceCurationChanged extends HTTPError.id(
	"UnitReferenceCurationChanged",
	StatusCodes.CONFLICT,
) {
	override readonly message = "Unit reference curation has changed";
	readonly details: { readonly currentVersion: number };

	constructor(currentVersion: number) {
		super();
		this.details = { currentVersion };
	}
}

export class UnitReferenceLimitReached extends HTTPError.id(
	"UnitReferenceLimitReached",
	StatusCodes.CONFLICT,
) {
	override readonly message = "Unit reference limit reached";
	readonly details: { readonly maxActiveReferences: number };

	constructor(maxActiveReferences: number) {
		super();
		this.details = { maxActiveReferences };
	}
}

export class UnitReferencePinnedLimitReached extends HTTPError.id(
	"UnitReferencePinnedLimitReached",
	StatusCodes.CONFLICT,
) {
	override readonly message = "Pinned Unit reference limit reached";
	readonly details: { readonly maxPinnedReferences: number };

	constructor(maxPinnedReferences: number) {
		super();
		this.details = { maxPinnedReferences };
	}
}

export class UnitReferenceWithdrawn extends HTTPError.id(
	"UnitReferenceWithdrawn",
	StatusCodes.CONFLICT,
) {
	override readonly message = "Unit reference has been withdrawn";
}

export const UnitResourceErrors = [
	AliasNotFound,
	TagApplicationNotFound,
	UnitTagCurationChanged,
	UnitExternalLinkNotFound,
	UnitReferenceCurationChanged,
	UnitReferenceLimitReached,
	UnitReferencePinnedLimitReached,
	UnitReferenceWithdrawn,
] as const;
