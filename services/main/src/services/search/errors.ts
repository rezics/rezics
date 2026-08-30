import { StatusCodes } from "http-status-codes";
import { HTTPError } from "elysia";

export class InvalidSearch extends HTTPError.id("InvalidSearch", StatusCodes.UNPROCESSABLE_ENTITY) {
	constructor(override readonly message: string) {
		super();
	}
}

export class SearchUnavailable extends HTTPError.id(
	"SearchUnavailable",
	StatusCodes.SERVICE_UNAVAILABLE,
) {
	override readonly message = "Search service unavailable";

	constructor(override readonly cause?: unknown) {
		super();
	}
}

export class SharedSearchQueryNotFound extends HTTPError.id(
	"SharedSearchQueryNotFound",
	StatusCodes.NOT_FOUND,
) {
	override readonly message = "Shared Search query does not exist";
}

export const SearchErrors = [InvalidSearch, SearchUnavailable, SharedSearchQueryNotFound] as const;
