import { StatusCodes } from "http-status-codes";
import * as Data from "effect/Data";

export class InvalidSearch extends Data.TaggedError("InvalidSearch") {
	static readonly status = StatusCodes.UNPROCESSABLE_ENTITY as const;
	readonly status = InvalidSearch.status;

	constructor(readonly message: string) {
		super();
	}
}

export class SearchUnavailable extends Data.TaggedError("SearchUnavailable") {
	static readonly status = StatusCodes.SERVICE_UNAVAILABLE as const;
	readonly status = SearchUnavailable.status;
	readonly message = "Search service unavailable";

	constructor(readonly cause?: unknown) {
		super();
	}
}

export class SearchDocumentRevisionConflict extends Data.TaggedError(
	"SearchDocumentRevisionConflict",
) {
	static readonly status = StatusCodes.CONFLICT as const;
	readonly status = SearchDocumentRevisionConflict.status;
	readonly message = "Search document changed since the supplied base revision";

	constructor(readonly latestRevisionId: string | null) {
		super();
	}
}

export class ZoneSearchFeatureNotFound extends Data.TaggedError("ZoneSearchFeatureNotFound") {
	static readonly status = StatusCodes.NOT_FOUND as const;
	readonly status = ZoneSearchFeatureNotFound.status;
	readonly message = "Zone Search Feature is not configured";
}

export class SharedSearchQueryNotFound extends Data.TaggedError("SharedSearchQueryNotFound") {
	static readonly status = StatusCodes.NOT_FOUND as const;
	readonly status = SharedSearchQueryNotFound.status;
	readonly message = "Shared Search query does not exist";
}

export const SearchErrors = [
	InvalidSearch,
	SearchUnavailable,
	SearchDocumentRevisionConflict,
	ZoneSearchFeatureNotFound,
	SharedSearchQueryNotFound,
] as const;
