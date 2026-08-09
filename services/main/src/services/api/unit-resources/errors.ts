import { StatusCodes } from "http-status-codes";
import * as Data from "effect/Data";

export class AliasNotFound extends Data.TaggedError("AliasNotFound") {
	static readonly status = StatusCodes.NOT_FOUND as const;
	readonly status = AliasNotFound.status;
	readonly message = "Alias not found";
}

export class TagApplicationNotFound extends Data.TaggedError("TagApplicationNotFound") {
	static readonly status = StatusCodes.NOT_FOUND as const;
	readonly status = TagApplicationNotFound.status;
	readonly message: string;

	constructor(afterUpsert = false) {
		super();
		this.message = afterUpsert
			? "Tag application not found after upsert"
			: "Tag application not found";
	}
}

export class UnitTagCurationChanged extends Data.TaggedError("UnitTagCurationChanged") {
	static readonly status = StatusCodes.CONFLICT as const;
	readonly status = UnitTagCurationChanged.status;
	readonly message = "Unit Tag curation has changed";
	readonly details: { readonly currentFeaturedTagIds: string[] };

	constructor(currentFeaturedTagIds: readonly string[]) {
		super();
		this.details = { currentFeaturedTagIds: [...currentFeaturedTagIds] };
	}
}

export class UnitExternalLinkNotFound extends Data.TaggedError("UnitExternalLinkNotFound") {
	static readonly status = StatusCodes.NOT_FOUND as const;
	readonly status = UnitExternalLinkNotFound.status;
	readonly message = "Unit external link not found";
}

export class UnitReferenceCurationChanged extends Data.TaggedError("UnitReferenceCurationChanged") {
	static readonly status = StatusCodes.CONFLICT as const;
	readonly status = UnitReferenceCurationChanged.status;
	readonly message = "Unit reference curation has changed";
	readonly details: { readonly currentVersion: number };

	constructor(currentVersion: number) {
		super();
		this.details = { currentVersion };
	}
}

export class UnitReferenceLimitReached extends Data.TaggedError("UnitReferenceLimitReached") {
	static readonly status = StatusCodes.CONFLICT as const;
	readonly status = UnitReferenceLimitReached.status;
	readonly message = "Unit reference limit reached";
	readonly details: { readonly maxActiveReferences: number };

	constructor(maxActiveReferences: number) {
		super();
		this.details = { maxActiveReferences };
	}
}

export class UnitReferencePinnedLimitReached extends Data.TaggedError(
	"UnitReferencePinnedLimitReached",
) {
	static readonly status = StatusCodes.CONFLICT as const;
	readonly status = UnitReferencePinnedLimitReached.status;
	readonly message = "Pinned Unit reference limit reached";
	readonly details: { readonly maxPinnedReferences: number };

	constructor(maxPinnedReferences: number) {
		super();
		this.details = { maxPinnedReferences };
	}
}

export class UnitReferenceWithdrawn extends Data.TaggedError("UnitReferenceWithdrawn") {
	static readonly status = StatusCodes.CONFLICT as const;
	readonly status = UnitReferenceWithdrawn.status;
	readonly message = "Unit reference has been withdrawn";
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
