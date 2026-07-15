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

export const SearchErrors = [InvalidSearch, SearchUnavailable] as const;
