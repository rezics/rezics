import { StatusCodes } from "http-status-codes";
import * as Data from "effect/Data";

export class InvalidHistoryCursor extends Data.TaggedError("InvalidHistoryCursor") {
	static readonly status = StatusCodes.BAD_REQUEST as const;
	readonly status = InvalidHistoryCursor.status;
	readonly message = "Invalid history cursor";
}

export class UnitRevisionNotFound extends Data.TaggedError("UnitRevisionNotFound") {
	static readonly status = StatusCodes.NOT_FOUND as const;
	readonly status = UnitRevisionNotFound.status;
	readonly message = "Unit revision not found";
}

export class CurrentRevisionContentVisibilityForbidden extends Data.TaggedError(
	"CurrentRevisionContentVisibilityForbidden",
) {
	static readonly status = StatusCodes.CONFLICT as const;
	readonly status = CurrentRevisionContentVisibilityForbidden.status;
	readonly message = "Restore another revision before hiding the current revision content";
}

export const HistoryErrors = [
	InvalidHistoryCursor,
	UnitRevisionNotFound,
	CurrentRevisionContentVisibilityForbidden,
] as const;
